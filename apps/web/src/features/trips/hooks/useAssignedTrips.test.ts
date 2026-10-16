import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PorterAssignedTrip, PorterTripOperations } from "../types";
import { useAssignedTripOperations, useAssignedTrips } from "./useAssignedTrips";

const assignedTrip: PorterAssignedTrip = {
	tripId: "trip-1",
	title: "Chuyến đi được phân công",
	status: "published",
	startsAt: "2035-01-01T00:00:00.000Z",
	endsAt: "2035-01-01T08:00:00.000Z",
	routeName: "Bạch Mã",
};

function createWrapper() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

describe("useAssignedTrips", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		localStorage.setItem("authUser", JSON.stringify({ id: "porter" }));
	});
	afterEach(() => vi.restoreAllMocks());

	it("loads assigned Trips and supports empty data", async () => {
		const loadAssignedTrips = vi.fn().mockResolvedValue([]);
		const { result } = renderHook(() => useAssignedTrips(loadAssignedTrips), {
			wrapper: createWrapper(),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.trips).toEqual([]);
	});
	it("does not load a list without an authenticated Porter identity", () => {
		localStorage.clear();
		const loadAssignedTrips = vi.fn().mockResolvedValue([assignedTrip]);
		const { result } = renderHook(() => useAssignedTrips(loadAssignedTrips), {
			wrapper: createWrapper(),
		});
		expect(loadAssignedTrips).not.toHaveBeenCalled();
		expect(result.current.trips).toEqual([]);
		expect(result.current.error).toContain("Vui lòng đăng nhập");
	});

	it("supports error and retry", async () => {
		const loadAssignedTrips = vi
			.fn()
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValue([assignedTrip]);
		const { result } = renderHook(() => useAssignedTrips(loadAssignedTrips), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.error).toBeTruthy());
		await act(async () => void (await result.current.refetch()));
		await waitFor(() => expect(result.current.trips).toEqual([assignedTrip]));
		expect(result.current.error).toBeNull();
	});

	it("does not share cached assignments between authenticated Porters", async () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
		const wrapper = ({ children }: { children: ReactNode }) =>
			createElement(QueryClientProvider, { client }, children);
		localStorage.setItem("authUser", JSON.stringify({ id: "porter-a" }));
		const first = renderHook(() => useAssignedTrips(async () => [assignedTrip]), { wrapper });
		await waitFor(() => expect(first.result.current.trips).toHaveLength(1));
		first.unmount();
		localStorage.setItem("authUser", JSON.stringify({ id: "porter-b" }));
		const second = renderHook(() => useAssignedTrips(async () => []), { wrapper });
		expect(second.result.current.trips).toEqual([]);
		await waitFor(() => expect(second.result.current.isLoading).toBe(false));
		expect(second.result.current.trips).toEqual([]);
		client.clear();
	});
});

describe("useAssignedTripOperations", () => {
	const data: PorterTripOperations = {
		...assignedTrip,
		assignmentStatus: "assigned",
		updatedAt: assignedTrip.startsAt,
		retrievedAt: assignedTrip.startsAt,
		meetingAt: null,
		meetingPoint: null,
		meetingPointName: null,
		waypoints: [],
		route: null,
		members: [],
		weather: { availability: "unavailable", record: null, maxAgeMinutes: 60 },
		offlinePackage: { status: "unavailable", downloadedAt: null },
	};
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem("authUser", JSON.stringify({ id: "porter" }));
	});
	afterEach(() => vi.restoreAllMocks());
	it("does not request operations until an assigned Trip is selected", () => {
		const service = vi.spyOn(tripsService, "getAssignedTripOperations");
		const { result } = renderHook(() => useAssignedTripOperations(null), {
			wrapper: createWrapper(),
		});
		expect(service).not.toHaveBeenCalled();
		expect(result.current.isLoading).toBe(false);
	});
	it("does not load operational data without an authenticated Porter identity", () => {
		localStorage.clear();
		const service = vi.spyOn(tripsService, "getAssignedTripOperations");
		const { result } = renderHook(() => useAssignedTripOperations("trip-1"), {
			wrapper: createWrapper(),
		});
		expect(service).not.toHaveBeenCalled();
		expect(result.current.data).toBeUndefined();
	});
	it.each([403, 404])("hides cached operational data after HTTP %s revocation", async (status) => {
		vi.spyOn(tripsService, "getAssignedTripOperations")
			.mockResolvedValueOnce(data)
			.mockRejectedValueOnce(new HttpError("revoked", status, null));
		const { result } = renderHook(() => useAssignedTripOperations("trip-1"), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.data).toEqual(data));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.data).toBeUndefined());
		expect(result.current.error).toContain("Phân công không còn hợp lệ");
	});
	it("hides stale cached information on network failure and recovers on retry", async () => {
		vi.spyOn(tripsService, "getAssignedTripOperations")
			.mockResolvedValueOnce(data)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce(data);
		const { result } = renderHook(() => useAssignedTripOperations("trip-1"), {
			wrapper: createWrapper(),
		});
		await waitFor(() => expect(result.current.data).toEqual(data));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.error).toBeTruthy());
		expect(result.current.data).toBeUndefined();
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.data).toEqual(data));
		expect(result.current.error).toBeNull();
	});
});

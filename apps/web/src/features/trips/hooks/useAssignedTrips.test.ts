import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PorterAssignedTrip } from "../types";
import { useAssignedTrips } from "./useAssignedTrips";

const assignedTrip: PorterAssignedTrip = {
	tripId: "trip-1",
	title: "Chuyến đi được phân công",
	status: "published",
	startsAt: "2035-01-01T00:00:00.000Z",
	endsAt: "2035-01-01T08:00:00.000Z",
};

function createWrapper() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

describe("useAssignedTrips", () => {
	beforeEach(() => vi.clearAllMocks());

	it("loads assigned Trips and supports empty data", async () => {
		const loadAssignedTrips = vi.fn().mockResolvedValue([]);
		const { result } = renderHook(() => useAssignedTrips(loadAssignedTrips), {
			wrapper: createWrapper(),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.trips).toEqual([]);
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
});

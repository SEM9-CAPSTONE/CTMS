import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { TripDetails } from "../types";
import { useMyTrips } from "./useMyTrips";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		getMyTrips: vi.fn(),
	},
}));

const mockTripsService = vi.mocked(tripsService);

const sampleTrip: TripDetails = {
	id: "trip-1",
	hostId: "host-1",
	title: "Sơn Trà Trekking Discovery",
	description: "Trekking Sơn Trà",
	coverImageUrl: "https://example.com/sontra.jpg",
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2026-10-01T06:00:00.000Z",
	endsAt: "2026-10-01T14:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.25, 16.1] },
	meetingAt: "2026-10-01T05:30:00.000Z",
	bookingDeadline: "2026-09-30T12:00:00.000Z",
	capacityMin: 5,
	capacityMax: 15,
	seatsTaken: 3,
	remainingSeats: 12,
	pricePerPerson: 550000,
	cancellationPolicy: null,
	status: "published",
	difficulty: "moderate",
	weatherRiskLevel: "green",
	isBookable: true,
	createdAt: "2026-09-20T00:00:00.000Z",
	updatedAt: "2026-09-20T00:00:00.000Z",
	waypoints: [],
};

describe("useMyTrips", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches host trips successfully on mount", async () => {
		mockTripsService.getMyTrips.mockResolvedValueOnce([sampleTrip]);

		const { result } = renderHook(() => useMyTrips());

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.trips).toEqual([sampleTrip]);
		expect(result.current.error).toBe("");
	});

	it("handles 403 Forbidden error with appropriate message", async () => {
		mockTripsService.getMyTrips.mockRejectedValueOnce(
			new HttpError("Forbidden", 403, { message: "Forbidden" })
		);

		const { result } = renderHook(() => useMyTrips());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.trips).toEqual([]);
		expect(result.current.error).toBe("Bạn không có quyền Host để xem danh sách chuyến đi.");
	});

	it("allows refetching trips via refetch()", async () => {
		mockTripsService.getMyTrips
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValueOnce([sampleTrip]);

		const { result } = renderHook(() => useMyTrips());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.error).toBe(
			"Không thể tải danh sách chuyến đi của bạn. Vui lòng thử lại."
		);

		await act(async () => {
			await result.current.refetch();
		});

		expect(result.current.trips).toEqual([sampleTrip]);
		expect(result.current.error).toBe("");
	});
});

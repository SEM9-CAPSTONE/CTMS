import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { TripDetails } from "../types";
import { useTripDetail } from "./useTripDetail";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		create: vi.fn(),
		search: vi.fn(),
		getById: vi.fn(),
	},
}));

const mockTripDetails: TripDetails = {
	id: "trip-1",
	hostId: "host-1",
	title: "Chinh Phục Đỉnh Núi Bidoup",
	description: "Cung đường trekking 2N1Đ tuyệt đẹp",
	coverImageUrl: null,
	itinerary: { summary: "Lịch trình 2 ngày 1 đêm" },
	includes: { items: ["Lều trại", "Ăn uống"] },
	excludes: { items: ["Chi phí cá nhân"] },
	tripType: "overnight",
	durationNights: 1,
	startsAt: "2026-09-28T06:00:00.000Z",
	endsAt: "2026-09-29T17:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.45, 11.94] },
	meetingAt: "2026-09-28T05:00:00.000Z",
	bookingDeadline: "2026-09-26T23:00:00.000Z",
	capacityMin: 8,
	capacityMax: 16,
	seatsTaken: 10,
	remainingSeats: 6,
	pricePerPerson: 1850000,
	cancellationPolicy: { policy: "Hủy trước 5 ngày hoàn 80%" },
	status: "published",
	difficulty: "moderate",
	weatherRiskLevel: "yellow",
	isBookable: true,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
	waypoints: [
		{
			id: "wp-1",
			tripId: "trip-1",
			checkpointId: null,
			type: "start",
			name: "Trụ sở VQG",
			location: { type: "Point", coordinates: [108.45, 11.94] },
			dayNumber: 1,
			sequenceOrder: 1,
			plannedAt: "2026-09-28T06:00:00.000Z",
			durationMinutes: 45,
			metadata: null,
		},
	],
};

describe("useTripDetail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches trip details by tripId successfully", async () => {
		vi.mocked(tripsService.getById).mockResolvedValue(mockTripDetails);

		const { result } = renderHook(() => useTripDetail("trip-1"));

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.trip).toEqual(mockTripDetails);
		expect(result.current.isNotFound).toBe(false);
		expect(result.current.error).toBeNull();
		expect(tripsService.getById).toHaveBeenCalledWith("trip-1");
	});

	it("handles 404 not found trip", async () => {
		vi.mocked(tripsService.getById).mockRejectedValue(new HttpError("Trip not found", 404, {}));

		const { result } = renderHook(() => useTripDetail("non-existent-id"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.isNotFound).toBe(true);
		expect(result.current.trip).toBeNull();
		expect(result.current.error).toContain("Chuyến đi không tồn tại hoặc đã kết thúc");
	});

	it("handles general error and allows retry", async () => {
		vi.mocked(tripsService.getById).mockRejectedValue(new HttpError("Server error", 500, {}));

		const { result } = renderHook(() => useTripDetail("trip-1"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.error).toContain("Không thể tải thông tin chuyến đi");

		vi.mocked(tripsService.getById).mockResolvedValue(mockTripDetails);

		await act(async () => {
			await result.current.retry();
		});

		expect(result.current.error).toBeNull();
		expect(result.current.trip).toEqual(mockTripDetails);
	});

	it("handles missing tripId gracefully", async () => {
		const { result } = renderHook(() => useTripDetail(undefined));

		expect(result.current.isLoading).toBe(false);
		expect(result.current.isNotFound).toBe(true);
		expect(result.current.error).toContain("Không tìm thấy mã chuyến đi");
	});
});

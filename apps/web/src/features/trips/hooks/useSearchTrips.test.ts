import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PaginatedTrips } from "../types";
import { useSearchTrips } from "./useSearchTrips";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		create: vi.fn(),
		search: vi.fn(),
		getById: vi.fn(),
	},
}));

const mockPaginatedTrips: PaginatedTrips = {
	items: [
		{
			id: "trip-1",
			title: "Sơn Trà Discovery",
			description: "Chuyến đi trong ngày ngắm voọc chà vá",
			coverImageUrl: null,
			tripType: "day_trip",
			durationNights: 0,
			startsAt: "2026-09-25T07:00:00.000Z",
			endsAt: "2026-09-25T16:00:00.000Z",
			meetingPoint: { type: "Point", coordinates: [108.26, 16.11] },
			meetingAt: "2026-09-25T06:30:00.000Z",
			bookingDeadline: "2026-09-24T18:00:00.000Z",
			capacityMin: 5,
			capacityMax: 20,
			seatsTaken: 8,
			remainingSeats: 12,
			pricePerPerson: 450000,
			status: "published",
			difficulty: "easy",
			weatherRiskLevel: "green",
			isBookable: true,
			createdAt: "2026-08-25T00:00:00.000Z",
			updatedAt: "2026-08-25T00:00:00.000Z",
		},
	],
	pagination: {
		page: 1,
		limit: 12,
		total: 1,
		totalPages: 1,
	},
};

describe("useSearchTrips", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches trips automatically on mount", async () => {
		vi.mocked(tripsService.search).mockResolvedValueOnce(mockPaginatedTrips);

		const { result } = renderHook(() => useSearchTrips());

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.items).toHaveLength(1);
		expect(result.current.items[0].title).toBe("Sơn Trà Discovery");
		expect(result.current.error).toBeNull();
		expect(tripsService.search).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, limit: 12 })
		);
	});

	it("updates filters and resets page to 1", async () => {
		vi.mocked(tripsService.search).mockResolvedValue(mockPaginatedTrips);

		const { result } = renderHook(() => useSearchTrips({ autoFetch: false }));

		act(() => {
			result.current.updateFilters({ difficulty: "hard", search: "Bidoup" });
		});

		expect(result.current.query.difficulty).toBe("hard");
		expect(result.current.query.search).toBe("Bidoup");
		expect(result.current.query.page).toBe(1);
	});

	it("updates page without resetting other filters", async () => {
		vi.mocked(tripsService.search).mockResolvedValue(mockPaginatedTrips);

		const { result } = renderHook(() =>
			useSearchTrips({
				autoFetch: false,
				initialQuery: { difficulty: "moderate", page: 1 },
			})
		);

		act(() => {
			result.current.setPage(2);
		});

		expect(result.current.query.page).toBe(2);
		expect(result.current.query.difficulty).toBe("moderate");
	});

	it("handles 422 validation error", async () => {
		vi.mocked(tripsService.search).mockRejectedValueOnce(
			new HttpError("Validation failed", 422, {})
		);

		const { result } = renderHook(() => useSearchTrips());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.error).toContain("Bộ lọc tìm kiếm không hợp lệ");
		expect(result.current.items).toHaveLength(0);
	});

	it("handles network error and retries", async () => {
		vi.mocked(tripsService.search).mockRejectedValueOnce(new Error("Network failed"));

		const { result } = renderHook(() => useSearchTrips());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.error).toContain("Lỗi kết nối mạng");

		vi.mocked(tripsService.search).mockResolvedValueOnce(mockPaginatedTrips);

		await act(async () => {
			await result.current.retry();
		});

		expect(result.current.error).toBeNull();
		expect(result.current.items).toHaveLength(1);
	});

	it("resets filters to default", () => {
		const { result } = renderHook(() =>
			useSearchTrips({
				autoFetch: false,
				initialQuery: { search: "Test", difficulty: "expert", page: 3 },
			})
		);

		act(() => {
			result.current.resetFilters();
		});

		expect(result.current.query.search).toBeUndefined();
		expect(result.current.query.difficulty).toBeUndefined();
		expect(result.current.query.page).toBe(1);
		expect(result.current.query.limit).toBe(12);
	});
});

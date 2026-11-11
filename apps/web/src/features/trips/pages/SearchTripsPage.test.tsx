import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchTrips } from "../hooks/useSearchTrips";
import type { PaginatedTrips } from "../types";
import { SearchTripsPage } from "./SearchTripsPage";

vi.mock("../hooks/useSearchTrips", () => ({
	useSearchTrips: vi.fn(),
}));

const mockPaginatedTrips: PaginatedTrips = {
	items: [
		{
			id: "trip-001",
			title: "Trekking Sơn Trà",
			description: "Khám phá rừng nguyên sinh",
			coverImageUrl: null,
			tripType: "day_trip",
			durationNights: 0,
			startsAt: "2026-09-25T07:00:00.000Z",
			endsAt: "2026-09-25T16:00:00.000Z",
			meetingPoint: { type: "Point", coordinates: [108.26, 16.11] },
			meetingAt: null,
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

describe("SearchTripsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders page header, category pills, search controls, and trips list", () => {
		const updateFilters = vi.fn();
		vi.mocked(useSearchTrips).mockReturnValue({
			query: { page: 1, limit: 12 },
			data: mockPaginatedTrips,
			items: mockPaginatedTrips.items,
			pagination: mockPaginatedTrips.pagination,
			isLoading: false,
			error: null,
			updateFilters,
			setPage: vi.fn(),
			retry: vi.fn(),
			resetFilters: vi.fn(),
		});

		const onNavigateToTripDetail = vi.fn();

		render(<SearchTripsPage onNavigateToTripDetail={onNavigateToTripDetail} />);

		expect(screen.getByText("Khám phá chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("Trekking Sơn Trà")).toBeInTheDocument();

		// Check Category Pills
		expect(screen.getByRole("button", { name: "Tất cả chuyến đi" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Trong ngày" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Qua đêm" })).toBeInTheDocument();

		// Click a category pill
		fireEvent.click(screen.getByRole("button", { name: "Qua đêm" }));
		expect(updateFilters).toHaveBeenCalledWith(
			expect.objectContaining({
				tripType: "overnight",
			})
		);

		fireEvent.click(screen.getByRole("button", { name: /chi tiết/i }));
		expect(onNavigateToTripDetail).toHaveBeenCalledWith("trip-001");
	});

	it("renders loading state", () => {
		vi.mocked(useSearchTrips).mockReturnValue({
			query: { page: 1, limit: 12 },
			data: null,
			items: [],
			pagination: null,
			isLoading: true,
			error: null,
			updateFilters: vi.fn(),
			setPage: vi.fn(),
			retry: vi.fn(),
			resetFilters: vi.fn(),
		});

		render(<SearchTripsPage onNavigateToTripDetail={vi.fn()} />);

		expect(screen.getByTestId("trips-loading")).toBeInTheDocument();
	});

	it("renders empty state", () => {
		vi.mocked(useSearchTrips).mockReturnValue({
			query: { page: 1, limit: 12 },
			data: { items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } },
			items: [],
			pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
			isLoading: false,
			error: null,
			updateFilters: vi.fn(),
			setPage: vi.fn(),
			retry: vi.fn(),
			resetFilters: vi.fn(),
		});

		render(<SearchTripsPage onNavigateToTripDetail={vi.fn()} />);

		expect(screen.getByTestId("trips-empty")).toBeInTheDocument();
	});
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripSummary, TripsPagination } from "../types";
import { TripList } from "./TripList";

const sampleTrips: TripSummary[] = [
	{
		id: "trip-1",
		title: "Trip 1",
		description: "Description 1",
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
];

const samplePagination: TripsPagination = {
	page: 1,
	limit: 12,
	total: 15,
	totalPages: 2,
};

describe("TripList", () => {
	it("renders loading state with skeleton testid", () => {
		render(
			<TripList
				items={[]}
				pagination={null}
				isLoading={true}
				error={null}
				onRetry={vi.fn()}
				onSelectTrip={vi.fn()}
				onPageChange={vi.fn()}
			/>
		);

		expect(screen.getByTestId("trips-loading")).toBeInTheDocument();
		expect(screen.getByText("Đang tải danh sách chuyến đi...")).toBeInTheDocument();
	});

	it("renders error alert and triggers retry", () => {
		const onRetry = vi.fn();
		render(
			<TripList
				items={[]}
				pagination={null}
				isLoading={false}
				error="Không thể tải danh sách chuyến đi."
				onRetry={onRetry}
				onSelectTrip={vi.fn()}
				onPageChange={vi.fn()}
			/>
		);

		expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải danh sách chuyến đi.");
		fireEvent.click(screen.getByRole("button", { name: /tải lại/i }));
		expect(onRetry).toHaveBeenCalled();
	});

	it("renders empty state when items list is empty", () => {
		render(
			<TripList
				items={[]}
				pagination={null}
				isLoading={false}
				error={null}
				onRetry={vi.fn()}
				onSelectTrip={vi.fn()}
				onPageChange={vi.fn()}
			/>
		);

		expect(screen.getByTestId("trips-empty")).toBeInTheDocument();
		expect(screen.getByText("Không tìm thấy chuyến đi nào phù hợp")).toBeInTheDocument();
	});

	it("renders trip items and handles pagination", () => {
		const onSelectTrip = vi.fn();
		const onPageChange = vi.fn();

		render(
			<TripList
				items={sampleTrips}
				pagination={samplePagination}
				isLoading={false}
				error={null}
				onRetry={vi.fn()}
				onSelectTrip={onSelectTrip}
				onPageChange={onPageChange}
			/>
		);

		expect(screen.getByText("Trip 1")).toBeInTheDocument();

		const nextButton = screen.getByRole("button", { name: "Trang sau" });
		fireEvent.click(nextButton);
		expect(onPageChange).toHaveBeenCalledWith(2);

		const prevButton = screen.getByRole("button", { name: "Trang trước" });
		expect(prevButton).toBeDisabled();
	});
});

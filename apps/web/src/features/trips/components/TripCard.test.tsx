import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripSummary } from "../types";
import { TripCard } from "./TripCard";

const sampleTrip: TripSummary = {
	id: "trip-123",
	title: "Chinh Phục Đỉnh Núi Bidoup",
	description: "Trekking qua rừng rêu cổ thụ Lâm Đồng",
	coverImageUrl: "https://example.com/bidoup.jpg",
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
	status: "published",
	difficulty: "moderate",
	weatherRiskLevel: "yellow",
	isBookable: true,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
};

describe("TripCard", () => {
	it("renders trip metadata, badges, and formatted price correctly", () => {
		const onSelect = vi.fn();
		render(<TripCard trip={sampleTrip} onSelect={onSelect} />);

		expect(screen.getByText("Chinh Phục Đỉnh Núi Bidoup")).toBeInTheDocument();
		expect(screen.getByText("Qua đêm (1N)")).toBeInTheDocument();
		expect(screen.getByText("Trung bình")).toBeInTheDocument();
		expect(screen.getByText("Thời tiết chú ý")).toBeInTheDocument();
		expect(screen.getByText("Còn 6 chỗ")).toBeInTheDocument();
		expect(screen.getByText(/1\.850\.000/)).toBeInTheDocument();
	});

	it("triggers onSelect when clicking Chi tiết", () => {
		const onSelect = vi.fn();
		render(<TripCard trip={sampleTrip} onSelect={onSelect} />);

		fireEvent.click(screen.getByRole("button", { name: /chi tiết/i }));
		expect(onSelect).toHaveBeenCalledWith("trip-123");
	});

	it("renders sold out state when remainingSeats is 0", () => {
		const soldOutTrip: TripSummary = {
			...sampleTrip,
			remainingSeats: 0,
			isBookable: false,
		};
		render(<TripCard trip={soldOutTrip} onSelect={vi.fn()} />);

		expect(screen.getByText("Đã hết chỗ")).toBeInTheDocument();
		expect(screen.getByText("Hết chỗ")).toBeInTheDocument();
	});

	it("renders day trip badge correctly", () => {
		const dayTrip: TripSummary = {
			...sampleTrip,
			tripType: "day_trip",
			durationNights: 0,
		};
		render(<TripCard trip={dayTrip} onSelect={vi.fn()} />);

		expect(screen.getByText("Trong ngày")).toBeInTheDocument();
	});
});

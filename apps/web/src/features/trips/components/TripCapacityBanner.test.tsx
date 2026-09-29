import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TripCapacityBanner } from "./TripCapacityBanner";

describe("TripCapacityBanner", () => {
	const futureDeadlineFar = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
	const futureDeadlineSoon = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
	const pastDeadline = new Date(Date.now() - 60 * 60 * 1000).toISOString();

	it("renders a neutral unavailable banner when the trip is not bookable for another reason", () => {
		render(
			<TripCapacityBanner
				remainingSeats={5}
				bookingDeadline={futureDeadlineFar}
				isBookable={false}
			/>
		);

		expect(screen.getByTestId("trip-capacity-banner-unavailable")).toBeInTheDocument();
		expect(screen.getByText("Hiện không thể đặt chỗ cho chuyến đi này")).toBeInTheDocument();
		expect(screen.queryByText("Đã hết chỗ")).not.toBeInTheDocument();
	});

	it("renders sold out banner when remainingSeats is 0", () => {
		render(
			<TripCapacityBanner
				remainingSeats={0}
				bookingDeadline={futureDeadlineFar}
				isBookable={true}
			/>
		);

		expect(screen.getByTestId("trip-capacity-banner-sold-out")).toBeInTheDocument();
		expect(screen.getByText("Đã hết chỗ")).toBeInTheDocument();
	});

	it("renders deadline-specific copy when seats remain but the booking deadline has passed", () => {
		render(
			<TripCapacityBanner remainingSeats={10} bookingDeadline={pastDeadline} isBookable={false} />
		);

		expect(screen.getByTestId("trip-capacity-banner-deadline-expired")).toBeInTheDocument();
		expect(screen.getByText("Đã hết hạn đặt chỗ")).toBeInTheDocument();
		expect(screen.queryByText("Đã hết chỗ")).not.toBeInTheDocument();
	});

	it("renders low seats urgency banner when remainingSeats <= 3", () => {
		render(
			<TripCapacityBanner
				remainingSeats={2}
				bookingDeadline={futureDeadlineFar}
				isBookable={true}
			/>
		);

		expect(screen.getByTestId("trip-capacity-banner-low-seats")).toBeInTheDocument();
		expect(screen.getByText("Chỉ còn 2 chỗ cuối cùng!")).toBeInTheDocument();
	});

	it("renders deadline approaching banner when deadline is within 24 hours and remainingSeats > 3", () => {
		render(
			<TripCapacityBanner
				remainingSeats={8}
				bookingDeadline={futureDeadlineSoon}
				isBookable={true}
			/>
		);

		expect(screen.getByTestId("trip-capacity-banner-deadline")).toBeInTheDocument();
		expect(screen.getByText("Sắp hết hạn đặt vé")).toBeInTheDocument();
	});

	it("renders nothing when capacity is normal and deadline is far away", () => {
		const { container } = render(
			<TripCapacityBanner
				remainingSeats={10}
				bookingDeadline={futureDeadlineFar}
				isBookable={true}
			/>
		);

		expect(container.firstChild).toBeNull();
	});
});

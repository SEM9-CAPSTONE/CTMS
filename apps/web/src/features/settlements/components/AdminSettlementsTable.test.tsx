import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripSettlementEvaluation } from "../types";
import { AdminSettlementsTable } from "./AdminSettlementsTable";

const mockItem: TripSettlementEvaluation = {
	tripId: "trip-12345678",
	tripTitle: "Trekking Fansipan 2N1D",
	hostId: "host-12345678",
	hostName: "Nguyen Van Host",
	tripStatus: "completed",
	completedAt: "2026-10-15T10:00:00.000Z",
	hoursSinceCompleted: 75,
	isCompleted: true,
	isHoldPeriodSatisfied: true,
	isComplaintWindowSatisfied: true,
	isBlocked: false,
	blockingReasons: [],
	isEligible: true,
	isSettled: false,
	settledAt: null,
	totalCharges: "2000000.00",
	totalSucceededRefunds: "0.00",
	settlementBase: "2000000.00",
	commissionRate: "0.05",
	platformFee: "100000.00",
	hostNetAmount: "1900000.00",
};

describe("AdminSettlementsTable", () => {
	it("renders trip name with compact text-xs style and no horizontal scrollbar min-width", () => {
		const onViewTrip = vi.fn();
		const onSettle = vi.fn();

		const { container } = render(
			<AdminSettlementsTable
				items={[mockItem]}
				isLoading={false}
				isSettling={false}
				onSettle={onSettle}
				onViewTrip={onViewTrip}
			/>
		);

		// Trip title should be rendered with text-xs
		const titleEl = screen.getByText("Trekking Fansipan 2N1D");
		expect(titleEl).toBeInTheDocument();
		expect(titleEl).toHaveClass("text-xs");

		// Table container must not have min-w-[900px] which causes horizontal scrollbar
		const tableEl = container.querySelector("table");
		expect(tableEl).not.toHaveClass("min-w-[900px]");

		// Scrollbar hidden classes should be present on wrapper
		const wrapper = container.querySelector("div.overflow-x-auto");
		expect(wrapper).toHaveClass("[scrollbar-width:none]");
	});

	it("calls onViewTrip when the detail eye icon button is clicked", () => {
		const onViewTrip = vi.fn();
		const onSettle = vi.fn();

		render(
			<AdminSettlementsTable
				items={[mockItem]}
				isLoading={false}
				isSettling={false}
				onSettle={onSettle}
				onViewTrip={onViewTrip}
			/>
		);

		const viewButton = screen.getByRole("button", {
			name: /Xem chi tiết chuyến đi Trekking Fansipan 2N1D/i,
		});
		expect(viewButton).toBeInTheDocument();

		fireEvent.click(viewButton);
		expect(onViewTrip).toHaveBeenCalledWith(mockItem);
	});
});

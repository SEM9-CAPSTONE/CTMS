import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripSettlementEvaluation } from "../types";
import { TripSettlementDetailModal } from "./TripSettlementDetailModal";

vi.mock("../../trips/hooks/useTripDetail", () => ({
	useTripDetail: vi.fn(() => ({
		trip: {
			id: "trip-12345678",
			title: "Trekking Fansipan 2N1D",
			tripType: "overnight",
			durationNights: 1,
			startsAt: "2026-10-20T08:00:00.000Z",
			endsAt: "2026-10-21T18:00:00.000Z",
			seatsTaken: 12,
			capacityMin: 5,
			capacityMax: 15,
			status: "completed",
			description: "Khám phá nóc nhà Đông Dương cùng hướng dẫn viên bản địa.",
			waypoints: [
				{
					id: "wp-1",
					name: "Trạm Tôn (Bắt đầu)",
					plannedAt: "2026-10-20T08:00:00.000Z",
				},
				{
					id: "wp-2",
					name: "Đỉnh Fansipan",
					plannedAt: "2026-10-21T10:00:00.000Z",
				},
			],
		},
		isLoading: false,
		error: null,
		isNotFound: false,
		retry: vi.fn(),
	})),
}));

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

describe("TripSettlementDetailModal", () => {
	it("renders trip details, waypoints, and settlement information cleanly", () => {
		render(<TripSettlementDetailModal item={mockItem} isOpen={true} onClose={vi.fn()} />);

		expect(screen.getByText("Chi tiết chuyến đi")).toBeInTheDocument();
		expect(screen.getByText(/Trekking Fansipan 2N1D/i)).toBeInTheDocument();
		expect(screen.getByText("Nguyen Van Host")).toBeInTheDocument();
		expect(screen.getByText(/12 \/ 15 khách/i)).toBeInTheDocument();
		expect(
			screen.getByText("Khám phá nóc nhà Đông Dương cùng hướng dẫn viên bản địa.")
		).toBeInTheDocument();

		// Waypoints
		expect(screen.getByText(/1\. Trạm Tôn/i)).toBeInTheDocument();
		expect(screen.getByText(/2\. Đỉnh Fansipan/i)).toBeInTheDocument();

		// Financials (Single total display in footer)
		expect(screen.getByText("Thực nhận ví Host (95%):")).toBeInTheDocument();
		expect(screen.getByText("1.900.000 ₫")).toBeInTheDocument();
	});

	it("calls onClose when close button is clicked", () => {
		const onClose = vi.fn();
		render(<TripSettlementDetailModal item={mockItem} isOpen={true} onClose={onClose} />);

		const closeButtons = screen.getAllByRole("button", { name: "Đóng" });
		expect(closeButtons.length).toBe(2);
		fireEvent.click(closeButtons[0]);
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onSettle when eligible and 'Quyết toán ngay' is clicked", async () => {
		const onSettle = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<TripSettlementDetailModal
				item={mockItem}
				isOpen={true}
				onClose={onClose}
				onSettle={onSettle}
			/>
		);

		const settleButton = screen.getByRole("button", { name: "Quyết toán ngay" });
		fireEvent.click(settleButton);

		expect(onSettle).toHaveBeenCalledWith(mockItem.tripId);
	});
});

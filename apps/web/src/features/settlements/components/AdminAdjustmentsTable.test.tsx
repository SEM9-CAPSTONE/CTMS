import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FinancialAdjustmentItem } from "../types";
import { AdminAdjustmentsTable } from "./AdminAdjustmentsTable";

const mockAdjustment: FinancialAdjustmentItem = {
	id: "adj-12345678-uuid",
	settlementId: "settle-1234-uuid",
	payoutId: null,
	bookingId: "booking-1234-uuid",
	camperName: "Nguyễn Văn An",
	bookingCreatedAt: "2026-10-10T05:00:00.000Z",
	settledAt: "2026-10-15T05:00:00.000Z",
	payoutRequestedAt: null,
	tripId: "trip-1234-uuid",
	tripTitle: "Trekking Fansipan 3N2D",
	hostId: "host-1234-uuid",
	hostName: "Trần Minh Quân",
	type: "post_settlement_refund",
	amount: "1500000.00",
	reason: "Camper verified medical emergency",
	status: "pending",
	actorId: "admin-1234-uuid",
	notes: "Check medical slip",
	createdAt: "2026-10-18T05:00:00.000Z",
	updatedAt: "2026-10-18T05:00:00.000Z",
};

describe("AdminAdjustmentsTable", () => {
	it("renders loading indicator when isLoading is true", () => {
		render(<AdminAdjustmentsTable items={[]} isLoading={true} onOpenDetailModal={vi.fn()} />);
		expect(screen.getByText("Đang tải khoản hoàn sau quyết toán...")).toBeInTheDocument();
	});

	it("renders empty state when items list is empty", () => {
		render(<AdminAdjustmentsTable items={[]} isLoading={false} onOpenDetailModal={vi.fn()} />);
		expect(screen.getByText("Không tìm thấy khoản hoàn sau quyết toán")).toBeInTheDocument();
	});

	it("renders adjustment row with details, type and status badge", () => {
		render(
			<AdminAdjustmentsTable
				items={[mockAdjustment]}
				isLoading={false}
				onOpenDetailModal={vi.fn()}
			/>
		);

		expect(screen.getByText("Trekking Fansipan 3N2D")).toBeInTheDocument();
		expect(screen.getByText("Trần Minh Quân")).toBeInTheDocument();
		expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
		expect(screen.queryByText(/uuid/)).not.toBeInTheDocument();
		expect(screen.queryByText(/#adj-/)).not.toBeInTheDocument();
		expect(screen.getByText("Hoàn tiền sau quyết toán")).toBeInTheDocument();
		expect(screen.getByText("Chờ xử lý")).toBeInTheDocument();
	});

	it("calls onOpenDetailModal when clicking the view detail button", () => {
		const onOpenDetailModal = vi.fn();

		render(
			<AdminAdjustmentsTable
				items={[mockAdjustment]}
				isLoading={false}
				onOpenDetailModal={onOpenDetailModal}
			/>
		);

		const detailButton = screen.getByRole("button", {
			name: `Xem khoản hoàn của ${mockAdjustment.camperName} cho chuyến ${mockAdjustment.tripTitle}`,
		});
		fireEvent.click(detailButton);

		expect(onOpenDetailModal).toHaveBeenCalledWith(mockAdjustment);
	});
});

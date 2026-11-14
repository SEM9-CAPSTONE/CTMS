import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FinancialAdjustmentItem } from "../types";
import { AdjustmentDetailModal } from "./AdjustmentDetailModal";

const mockPendingAdjustment: FinancialAdjustmentItem = {
	id: "adj-12345678-uuid",
	settlementId: "settle-1234-uuid",
	payoutId: "payout-5678-uuid",
	bookingId: "booking-9999-uuid",
	camperName: "Nguyễn Văn An",
	bookingCreatedAt: "2026-10-10T05:00:00.000Z",
	settledAt: "2026-10-15T05:00:00.000Z",
	payoutRequestedAt: "2026-10-16T05:00:00.000Z",
	tripId: "trip-8888-uuid",
	tripTitle: "Trekking Fansipan 3N2D",
	hostId: "host-7777-uuid",
	hostName: "Trần Minh Quân",
	type: "post_payout_recovery",
	amount: "2000000.00",
	reason: "Host rút tiền trước khi hoàn tiền ngoại lệ",
	status: "pending",
	actorId: "admin-1111-uuid",
	notes: "Cần thu hồi từ Host",
	createdAt: "2026-10-18T05:00:00.000Z",
	updatedAt: "2026-10-18T05:00:00.000Z",
};

describe("AdjustmentDetailModal", () => {
	it("renders complete adjustment details and traceability", () => {
		const { container } = render(
			<AdjustmentDetailModal
				adjustment={mockPendingAdjustment}
				isOpen={true}
				isResolving={false}
				onClose={vi.fn()}
				onResolve={vi.fn()}
			/>
		);

		expect(screen.getByText("Chi tiết khoản hoàn sau quyết toán")).toBeInTheDocument();
		expect(screen.getByText("Thu hồi sau rút tiền")).toBeInTheDocument();
		expect(screen.getByText("2.000.000 ₫")).toBeInTheDocument();
		expect(screen.getByText("Trekking Fansipan 3N2D")).toBeInTheDocument();
		expect(screen.getByText("Trần Minh Quân")).toBeInTheDocument();
		expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
		expect(screen.getByText(/10\/10\/2026/)).toBeInTheDocument();
		expect(screen.getByText(/15\/10\/2026/)).toBeInTheDocument();
		expect(screen.getByText(/16\/10\/2026/)).toBeInTheDocument();
		for (const id of [
			mockPendingAdjustment.id,
			mockPendingAdjustment.bookingId,
			mockPendingAdjustment.tripId,
			mockPendingAdjustment.hostId,
			mockPendingAdjustment.settlementId,
			mockPendingAdjustment.payoutId,
		]) {
			if (id) expect(container.textContent).not.toContain(id);
		}
		expect(screen.getByText("Host rút tiền trước khi hoàn tiền ngoại lệ")).toBeInTheDocument();
	});

	it("shows resolve input and triggers onResolve when pending", async () => {
		const onResolve = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<AdjustmentDetailModal
				adjustment={mockPendingAdjustment}
				isOpen={true}
				isResolving={false}
				onClose={onClose}
				onResolve={onResolve}
			/>
		);

		expect(screen.getByText("Chờ xử lý")).toBeInTheDocument();
		const textarea = screen.getByPlaceholderText(/Ghi chú xác nhận thu hồi/i);
		fireEvent.change(textarea, {
			target: { value: "Host đã chuyển khoản hoàn trả 2 triệu qua Techcombank" },
		});

		const resolveButton = screen.getByRole("button", {
			name: "Đánh dấu đã xử lý",
		});
		fireEvent.click(resolveButton);

		expect(onResolve).toHaveBeenCalledWith(
			mockPendingAdjustment.id,
			"Host đã chuyển khoản hoàn trả 2 triệu qua Techcombank"
		);
	});

	it("does not show resolve form when status is resolved", () => {
		const resolvedAdj: FinancialAdjustmentItem = {
			...mockPendingAdjustment,
			status: "resolved",
		};

		render(
			<AdjustmentDetailModal
				adjustment={resolvedAdj}
				isOpen={true}
				isResolving={false}
				onClose={vi.fn()}
				onResolve={vi.fn()}
			/>
		);

		expect(screen.getByText("Đã xử lý")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Đánh dấu đã xử lý" })).not.toBeInTheDocument();
	});
});

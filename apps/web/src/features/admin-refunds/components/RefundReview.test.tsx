import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RefundStatusCard } from "../../booking-refund/components/RefundStatusCard";
import type { BookingRefundInfo } from "../../booking-refund/types";
import type { AdminRefundItem } from "../types";
import { AdminRefundsTable } from "./AdminRefundsTable";
import { ApproveRefundModal } from "./ApproveRefundModal";

const request: AdminRefundItem = {
	id: "refund",
	bookingId: "booking",
	tripTitle: "Săn mây trên đỉnh Langbiang",
	camper: { id: "camper", fullName: "Nguyễn Văn An" },
	amount: "450000.00",
	status: "pending",
	reviewStatus: "pending_review",
	lateRequest: true,
	reason: "Khoản thu thừa đã được xác minh.",
	createdAt: "2026-11-13T10:00:00Z",
	updatedAt: "2026-11-13T10:00:00Z",
};

describe("Refund approval workflow", () => {
	it("requires review before exposing the transfer action", () => {
		const approve = vi.fn();
		render(
			<AdminRefundsTable
				refunds={[request]}
				isLoading={false}
				onOpenApprove={approve}
				onOpenConfirm={vi.fn()}
				onOpenReject={vi.fn()}
				onOpenDetail={vi.fn()}
			/>
		);
		expect(screen.getByText("Chờ duyệt")).toBeVisible();
		expect(screen.queryByText("Xác nhận chuyển tiền")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Duyệt hoàn tiền" }));
		expect(approve).toHaveBeenCalledWith(request);
	});
	it("allows transfer confirmation after approval and hides rejection", () => {
		render(
			<AdminRefundsTable
				refunds={[{ ...request, reviewStatus: "approved" }]}
				isLoading={false}
				onOpenApprove={vi.fn()}
				onOpenConfirm={vi.fn()}
				onOpenReject={vi.fn()}
				onOpenDetail={vi.fn()}
			/>
		);
		expect(screen.getByText("Đã duyệt, chờ chuyển tiền")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Duyệt hoàn tiền" })).not.toBeInTheDocument();
	});
	it("requires an explicit reason before approving an out-of-window request", async () => {
		const approve = vi.fn().mockResolvedValue(undefined);
		render(
			<ApproveRefundModal
				refund={request}
				isSubmitting={false}
				onClose={vi.fn()}
				onApprove={approve}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Chấp thuận hoàn tiền" }));
		await screen.findByText("Cần ghi lý do chấp thuận yêu cầu ngoài thời hạn.");
		expect(approve).not.toHaveBeenCalled();
		fireEvent.change(screen.getByLabelText("Lý do chấp thuận *"), {
			target: { value: "Đã đối chiếu và xác nhận khoản thu thừa." },
		});
		fireEvent.click(screen.getByRole("button", { name: "Chấp thuận hoàn tiền" }));
		await waitFor(() =>
			expect(approve).toHaveBeenCalledWith(request.id, "Đã đối chiếu và xác nhận khoản thu thừa.")
		);
	});
	it("shows the Camper that a pending request has not been accepted or paid yet", () => {
		const info: BookingRefundInfo = {
			bookingId: "booking",
			isEligible: false,
			totalRefundedAmount: "0.00",
			remainingRefundableAmount: "0.00",
			settlementBlocked: false,
			awaitingResolution: true,
			refunds: [
				{
					id: "refund",
					amount: "450000.00",
					status: "pending",
					reviewStatus: "pending_review",
					createdAt: request.createdAt,
				},
			],
		};
		render(<RefundStatusCard refundInfo={info} onRequestRefund={vi.fn()} isSubmitting={false} />);
		expect(screen.getByText("Yêu cầu đang chờ xét duyệt")).toBeVisible();
		expect(screen.queryByText("Đã hoàn tiền")).not.toBeInTheDocument();
	});
});

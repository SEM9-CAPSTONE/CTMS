import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AdminRefundItem } from "../types";
import { RefundDetailsModal } from "./RefundDetailsModal";

const mockRefundPending: AdminRefundItem = {
	id: "refund-12345678",
	bookingId: "booking-87654321",
	tripTitle: "Trekking Fansipan 3N2D",
	camper: {
		id: "camper-001",
		fullName: "Trần Thị Mai",
		email: "mai.tran@ctms.local",
		phone: "0912345678",
	},
	amount: "750000.00",
	status: "pending",
	reason: "Có lịch công tác đột xuất",
	beneficiary: {
		bankName: "MBBank",
		accountNumber: "9876543210",
		accountHolderName: "TRAN THI MAI",
	},
	createdAt: "2030-05-01T10:00:00Z",
	updatedAt: "2030-05-01T10:00:00Z",
};

const mockRefundProcessed: AdminRefundItem = {
	...mockRefundPending,
	id: "refund-8888",
	status: "succeeded",
	providerReference: "MB99887766",
	note: "Đã chuyển tiền qua app MB",
};

describe("RefundDetailsModal", () => {
	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	});

	it("does not render dialog content when refund is null", () => {
		render(<RefundDetailsModal refund={null} open={false} onClose={vi.fn()} />);
		expect(screen.queryByText("Chi tiết yêu cầu hoàn tiền")).not.toBeInTheDocument();
	});

	it("renders refund information accurately when open is true", () => {
		render(<RefundDetailsModal refund={mockRefundPending} open={true} onClose={vi.fn()} />);

		expect(screen.getByText("Chi tiết yêu cầu hoàn tiền")).toBeInTheDocument();
		expect(screen.getByText("#refund-12345678")).toBeInTheDocument();
		expect(screen.getByText("Trần Thị Mai")).toBeInTheDocument();
		expect(screen.getByText("mai.tran@ctms.local")).toBeInTheDocument();
		expect(screen.getByText("0912345678")).toBeInTheDocument();
		expect(screen.getByText("MBBank")).toBeInTheDocument();
		expect(screen.getByText("9876543210")).toBeInTheDocument();
		expect(screen.getByText("TRAN THI MAI")).toBeInTheDocument();
		expect(screen.getByText("Có lịch công tác đột xuất")).toBeInTheDocument();
	});

	it("renders action buttons for pending refund and triggers callbacks", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		const onReject = vi.fn();
		const onClose = vi.fn();

		render(
			<RefundDetailsModal
				refund={mockRefundPending}
				open={true}
				onClose={onClose}
				onOpenConfirm={onConfirm}
				onOpenReject={onReject}
			/>
		);

		const confirmBtn = screen.getByRole("button", { name: "Xác nhận chuyển tiền" });
		await user.click(confirmBtn);
		expect(onConfirm).toHaveBeenCalledWith(mockRefundPending);

		const rejectBtn = screen.getByRole("button", { name: "Từ chối" });
		await user.click(rejectBtn);
		expect(onReject).toHaveBeenCalledWith(mockRefundPending);

		const closeBtn = screen.getByRole("button", { name: "Đóng" });
		await user.click(closeBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it("does not render confirm and reject buttons when status is completed", () => {
		render(
			<RefundDetailsModal
				refund={mockRefundProcessed}
				open={true}
				onClose={vi.fn()}
				onOpenConfirm={vi.fn()}
				onOpenReject={vi.fn()}
			/>
		);

		expect(screen.queryByRole("button", { name: "Xác nhận chuyển tiền" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
		expect(screen.getByText("Mã GD ngân hàng:")).toBeInTheDocument();
		expect(screen.getByText("MB99887766")).toBeInTheDocument();
	});
});

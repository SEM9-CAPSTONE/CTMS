import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminPayoutItem } from "../types";
import { AdminPayoutDetailModal } from "./AdminPayoutDetailModal";

const mockPayout: AdminPayoutItem = {
	id: "payout-12345678",
	hostId: "host-12345678",
	hostName: "Host Ban Mai",
	hostEmail: "host@ctms.local",
	hostPhone: "0900000002",
	walletId: "wallet-12345678",
	amount: "1200000.00",
	status: "succeeded",
	bankName: "Vietcombank",
	accountNumber: "0123456789",
	accountHolderName: "HOST BAN MAI",
	transactionRef: "FT2610189999",
	rejectionReason: null,
	adminNotes: "Đã kiểm tra đối soát khớp sao kê",
	createdAt: "2026-10-18T05:00:00.000Z",
	updatedAt: "2026-10-18T06:00:00.000Z",
};

describe("AdminPayoutDetailModal", () => {
	it("renders complete payout details including bank and transaction reference", () => {
		render(<AdminPayoutDetailModal payout={mockPayout} isOpen={true} onClose={vi.fn()} />);

		expect(screen.getByText("Chi tiết yêu cầu rút tiền")).toBeInTheDocument();
		expect(screen.getByText(/Host: Host Ban Mai/i)).toBeInTheDocument();
		expect(screen.getByText("Vietcombank")).toBeInTheDocument();
		expect(screen.getByText("0123456789")).toBeInTheDocument();
		expect(screen.getByText("HOST BAN MAI")).toBeInTheDocument();
		expect(screen.getByText("FT2610189999")).toBeInTheDocument();
		expect(screen.getByText("Đã kiểm tra đối soát khớp sao kê")).toBeInTheDocument();
		expect(screen.getByText("Đã chuyển tiền")).toBeInTheDocument();

		// Single total display
		expect(screen.getByText("Số tiền yêu cầu rút:")).toBeInTheDocument();
		expect(screen.getByText("1.200.000 ₫")).toBeInTheDocument();
	});

	it("renders rejection reason when status is failed", () => {
		const failedPayout: AdminPayoutItem = {
			...mockPayout,
			status: "failed",
			transactionRef: null,
			rejectionReason: "Số tài khoản ngân hàng không đúng định dạng",
		};

		render(<AdminPayoutDetailModal payout={failedPayout} isOpen={true} onClose={vi.fn()} />);

		expect(screen.getByText("Đã từ chối")).toBeInTheDocument();
		expect(screen.getByText("Số tài khoản ngân hàng không đúng định dạng")).toBeInTheDocument();
	});

	it("renders confirm and reject buttons when status is pending", () => {
		const pendingPayout: AdminPayoutItem = {
			...mockPayout,
			status: "pending",
			transactionRef: null,
		};
		const onOpenConfirm = vi.fn();
		const onOpenReject = vi.fn();
		const onClose = vi.fn();

		render(
			<AdminPayoutDetailModal
				payout={pendingPayout}
				isOpen={true}
				onClose={onClose}
				onOpenConfirm={onOpenConfirm}
				onOpenReject={onOpenReject}
			/>
		);

		const confirmBtn = screen.getByRole("button", { name: "Xác nhận chuyển" });
		fireEvent.click(confirmBtn);
		expect(onClose).toHaveBeenCalled();
		expect(onOpenConfirm).toHaveBeenCalledWith(pendingPayout);
	});
});

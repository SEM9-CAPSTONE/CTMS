import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminPayoutItem } from "../types";
import { AdminPayoutsTable } from "./AdminPayoutsTable";

const mockPayout: AdminPayoutItem = {
	id: "payout-12345678",
	hostId: "host-12345678",
	hostName: "Host Ban Mai",
	hostEmail: "host@ctms.local",
	hostPhone: "0900000002",
	walletId: "wallet-12345678",
	amount: "1200000.00",
	status: "pending",
	bankName: "Vietcombank",
	accountNumber: "0123456789",
	accountHolderName: "HOST BAN MAI",
	transactionRef: null,
	rejectionReason: null,
	adminNotes: null,
	createdAt: "2026-10-18T05:00:00.000Z",
	updatedAt: "2026-10-18T05:00:00.000Z",
};

describe("AdminPayoutsTable", () => {
	it("does not render 'Mã GD / Lý do' column in the table", () => {
		const onOpenConfirmModal = vi.fn();
		const onOpenRejectModal = vi.fn();
		const onOpenDetailModal = vi.fn();

		render(
			<AdminPayoutsTable
				items={[mockPayout]}
				isLoading={false}
				onOpenConfirmModal={onOpenConfirmModal}
				onOpenRejectModal={onOpenRejectModal}
				onOpenDetailModal={onOpenDetailModal}
			/>
		);

		// 'Mã GD / Lý do' column header should NOT exist
		expect(screen.queryByText("Mã GD / Lý do")).not.toBeInTheDocument();
	});

	it("renders Eye icon button in actions column and calls onOpenDetailModal on click", () => {
		const onOpenConfirmModal = vi.fn();
		const onOpenRejectModal = vi.fn();
		const onOpenDetailModal = vi.fn();

		render(
			<AdminPayoutsTable
				items={[mockPayout]}
				isLoading={false}
				onOpenConfirmModal={onOpenConfirmModal}
				onOpenRejectModal={onOpenRejectModal}
				onOpenDetailModal={onOpenDetailModal}
			/>
		);

		const detailButton = screen.getByRole("button", {
			name: /Xem chi tiết yêu cầu payout-12345678/i,
		});
		expect(detailButton).toBeInTheDocument();

		fireEvent.click(detailButton);
		expect(onOpenDetailModal).toHaveBeenCalledWith(mockPayout);
	});
});

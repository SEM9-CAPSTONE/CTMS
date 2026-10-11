import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminRefundItem } from "../types";
import { AdminRefundsTable } from "./AdminRefundsTable";

const mockRefund: AdminRefundItem = {
	id: "refund-1",
	bookingId: "booking-1",
	tripTitle: "Trekking Fansipan 3N2D",
	camper: {
		id: "camper-1",
		fullName: "Nguyen Van A",
		email: "camper@ctms.local",
		phone: "0901234567",
	},
	amount: "500000.00",
	status: "pending",
	reason: "Bị ốm đột xuất không thể tham gia",
	beneficiary: {
		bankName: "Vietcombank",
		accountNumber: "0123456789",
		accountHolderName: "NGUYEN VAN A",
	},
	createdAt: "2030-05-01T10:00:00Z",
	updatedAt: "2030-05-01T10:00:00Z",
};

describe("AdminRefundsTable", () => {
	it("renders loading state", () => {
		render(
			<AdminRefundsTable
				refunds={[]}
				isLoading={true}
				onOpenConfirm={vi.fn()}
				onOpenReject={vi.fn()}
			/>
		);
		expect(screen.getByText("Đang tải danh sách yêu cầu hoàn tiền...")).toBeInTheDocument();
	});

	it("renders empty state", () => {
		render(
			<AdminRefundsTable
				refunds={[]}
				isLoading={false}
				onOpenConfirm={vi.fn()}
				onOpenReject={vi.fn()}
			/>
		);
		expect(screen.getByText("Không tìm thấy yêu cầu hoàn tiền nào")).toBeInTheDocument();
	});

	it("renders refund items and triggers action modals", async () => {
		const user = userEvent.setup();
		const onOpenConfirm = vi.fn();
		const onOpenReject = vi.fn();

		render(
			<AdminRefundsTable
				refunds={[mockRefund]}
				isLoading={false}
				onOpenConfirm={onOpenConfirm}
				onOpenReject={onOpenReject}
			/>
		);

		expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
		expect(screen.getByText("camper@ctms.local")).toBeInTheDocument();
		expect(screen.getByText("Vietcombank")).toBeInTheDocument();
		expect(screen.getByText("0123456789")).toBeInTheDocument();
		expect(screen.getByText("NGUYEN VAN A")).toBeInTheDocument();

		const confirmBtn = screen.getByRole("button", { name: "Xác nhận chuyển" });
		await user.click(confirmBtn);
		expect(onOpenConfirm).toHaveBeenCalledWith(mockRefund);

		const rejectBtn = screen.getByRole("button", { name: "Từ chối" });
		await user.click(rejectBtn);
		expect(onOpenReject).toHaveBeenCalledWith(mockRefund);
	});
});

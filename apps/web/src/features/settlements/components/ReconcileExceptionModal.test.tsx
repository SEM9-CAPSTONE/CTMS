import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReconcileExceptionModal } from "./ReconcileExceptionModal";

const bookings = [
	{
		id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
		camperName: "Nguyễn Văn An",
		tripTitle: "Khám phá Sơn Trà",
		createdAt: "2026-10-10T05:00:00Z",
		amount: "450000.00",
	},
];

describe("ReconcileExceptionModal", () => {
	it("renders modal form with all required inputs and warning banner", () => {
		render(
			<ReconcileExceptionModal
				isOpen={true}
				isSubmitting={false}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		expect(screen.getByText("Xử lý hoàn tiền sau quyết toán")).toBeInTheDocument();
		expect(screen.getByText("Ghi nhận khoản hoàn và tiền cần thu hồi")).toBeInTheDocument();
		expect(screen.getByLabelText(/Đơn đặt chỗ/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Lý do hoàn tiền/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Ghi chú nội bộ/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Ghi nhận khoản hoàn" })).toBeInTheDocument();
	});

	it("shows validation error when inputs are invalid", async () => {
		render(
			<ReconcileExceptionModal
				isOpen={true}
				isSubmitting={false}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
			/>
		);

		const submitBtn = screen.getByRole("button", { name: "Ghi nhận khoản hoàn" });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText("Vui lòng chọn đơn đặt chỗ")).toBeInTheDocument();
			expect(screen.getByText("Lý do phải có ít nhất 10 ký tự")).toBeInTheDocument();
		});
	});

	it("submits valid form successfully", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();

		render(
			<ReconcileExceptionModal
				isOpen={true}
				isSubmitting={false}
				onClose={onClose}
				onSubmit={onSubmit}
				bookings={bookings}
			/>
		);

		const bookingInput = screen.getByLabelText(/Đơn đặt chỗ/i);
		const reasonInput = screen.getByLabelText(/Lý do hoàn tiền/i);
		const notesInput = screen.getByLabelText(/Ghi chú nội bộ/i);

		fireEvent.change(bookingInput, {
			target: { value: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
		});
		fireEvent.change(reasonInput, {
			target: { value: "Camper gặp tai nạn giao thông đã xác thực bệnh viện" },
		});
		fireEvent.change(notesInput, {
			target: { value: "Biên bản duyệt ngày 15/10/2026" },
		});

		const submitBtn = screen.getByRole("button", { name: "Ghi nhận khoản hoàn" });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith({
				bookingId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
				reason: "Camper gặp tai nạn giao thông đã xác thực bệnh viện",
				notes: "Biên bản duyệt ngày 15/10/2026",
			});
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("closes modal on cancel button click", () => {
		const onClose = vi.fn();

		render(
			<ReconcileExceptionModal
				isOpen={true}
				isSubmitting={false}
				onClose={onClose}
				onSubmit={vi.fn()}
			/>
		);

		const cancelBtn = screen.getByRole("button", { name: "Hủy" });
		fireEvent.click(cancelBtn);

		expect(onClose).toHaveBeenCalled();
	});
});

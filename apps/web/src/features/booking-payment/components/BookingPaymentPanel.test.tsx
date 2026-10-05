import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { BookTripResponse } from "../../trips/types";
import { bookingPaymentService } from "../services/booking-payment.service";
import { BookingPaymentPanel } from "./BookingPaymentPanel";

const mockPendingBooking: BookTripResponse = {
	id: "11111111-1111-4111-8111-111111111111",
	tripId: "trip-1",
	userId: "user-1",
	numPeople: 2,
	status: "pending_payment",
	paymentStatus: "unpaid",
	holdExpiresAt: "2026-09-30T12:00:00.000Z",
	tripStartsAtSnapshot: "2026-10-01T08:00:00.000Z",
	tripEndsAtSnapshot: "2026-10-03T18:00:00.000Z",
	basePrice: "1000000.00",
	totalAmount: "1000000.00",
	cancellationPolicySnapshot: null,
	createdAt: "2026-09-29T10:00:00.000Z",
};

describe("BookingPaymentPanel", () => {
	it("renders payable state with amount and payment method selector", () => {
		render(<BookingPaymentPanel booking={mockPendingBooking} />);

		expect(screen.getByRole("heading", { name: "Thanh toán đặt chỗ" })).toBeInTheDocument();
		expect(screen.getByTestId("payment-amount-display")).toHaveTextContent("1.000.000");
		expect(screen.getByLabelText(/Chuyển khoản ngân hàng/i)).toBeChecked();
		expect(screen.getByLabelText(/Thẻ quốc tế/i)).toBeDisabled();
		expect(screen.getByRole("button", { name: "Thanh toán ngay" })).toBeInTheDocument();
	});

	it("uses updated totalAmount when passed as a prop", () => {
		render(<BookingPaymentPanel booking={mockPendingBooking} totalAmount="1500000.00" />);

		expect(screen.getByTestId("payment-amount-display")).toHaveTextContent("1.500.000");
	});

	it("submits payment and renders authoritative result on success", async () => {
		const successResult = {
			paymentId: "pay-12345",
			bookingId: mockPendingBooking.id,
			paymentStatus: "succeeded" as const,
			amount: "1000000.00",
			bookingStatus: "confirmed" as const,
			bookingPaymentStatus: "paid" as const,
			createdAt: "2026-09-29T10:30:00.000Z",
		};
		const paySpy = vi.spyOn(bookingPaymentService, "pay").mockResolvedValue(successResult);
		const onPaymentSuccess = vi.fn();

		render(
			<BookingPaymentPanel booking={mockPendingBooking} onPaymentSuccess={onPaymentSuccess} />
		);

		await userEvent.click(screen.getByRole("button", { name: "Thanh toán ngay" }));

		expect(paySpy).toHaveBeenCalledWith(
			mockPendingBooking.id,
			{ method: "BANK_TRANSFER" },
			expect.any(String)
		);
		expect(await screen.findByRole("status")).toHaveTextContent("Thanh toán thành công!");
		expect(screen.getByTestId("authoritative-payment-id")).toHaveTextContent("pay-12345");
		expect(screen.getByTestId("authoritative-payment-amount")).toHaveTextContent("1.000.000");
		expect(screen.getByTestId("authoritative-payment-status")).toHaveTextContent("succeeded");
		expect(screen.getByTestId("authoritative-booking-status")).toHaveTextContent("confirmed");
		expect(onPaymentSuccess).toHaveBeenCalledWith(successResult);

		paySpy.mockRestore();
	});

	it("disables card payment option with badge while allowing bank transfer", async () => {
		const successResult = {
			paymentId: "pay-bank-123",
			bookingId: mockPendingBooking.id,
			paymentStatus: "succeeded" as const,
			amount: "1000000.00",
			bookingStatus: "confirmed" as const,
			bookingPaymentStatus: "paid" as const,
			createdAt: "2026-09-29T10:30:00.000Z",
		};
		const paySpy = vi.spyOn(bookingPaymentService, "pay").mockResolvedValue(successResult);

		render(<BookingPaymentPanel booking={mockPendingBooking} />);

		const cardRadio = screen.getByLabelText(/Thẻ quốc tế/i);
		expect(cardRadio).toBeDisabled();
		expect(screen.getByText("Chưa hỗ trợ")).toBeInTheDocument();

		const bankRadio = screen.getByLabelText(/Chuyển khoản ngân hàng/i);
		expect(bankRadio).toBeChecked();
		expect(bankRadio).toBeEnabled();

		await userEvent.click(screen.getByRole("button", { name: "Thanh toán ngay" }));

		expect(paySpy).toHaveBeenCalledWith(
			mockPendingBooking.id,
			{ method: "BANK_TRANSFER" },
			expect.any(String)
		);

		paySpy.mockRestore();
	});

	it("shows blocked banner when booking is already confirmed and paid", () => {
		const paidBooking: BookTripResponse = {
			...mockPendingBooking,
			status: "confirmed",
			paymentStatus: "paid",
		};
		render(<BookingPaymentPanel booking={paidBooking} />);

		expect(screen.getByRole("status")).toHaveTextContent(
			"Đặt chỗ đã được thanh toán và xác nhận thành công."
		);
		expect(screen.queryByRole("button", { name: "Thanh toán ngay" })).not.toBeInTheDocument();
	});

	it("shows blocked banner for free confirmed booking", () => {
		const freeBooking: BookTripResponse = {
			...mockPendingBooking,
			status: "confirmed",
			paymentStatus: "not_required",
		};
		render(<BookingPaymentPanel booking={freeBooking} />);

		expect(screen.getByRole("status")).toHaveTextContent(
			"Đặt chỗ miễn phí, không yêu cầu thanh toán bổ sung."
		);
		expect(screen.queryByRole("button", { name: "Thanh toán ngay" })).not.toBeInTheDocument();
	});

	it("shows blocked alert when booking is cancelled", () => {
		const cancelledBooking: BookTripResponse = {
			...mockPendingBooking,
			status: "cancelled",
		};
		render(<BookingPaymentPanel booking={cancelledBooking} />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Đặt chỗ không ở trạng thái có thể thanh toán."
		);
		expect(screen.queryByRole("button", { name: "Thanh toán ngay" })).not.toBeInTheDocument();
	});

	it.each([
		["unpaid", "Chưa thanh toán"],
		["paid", "Đã thanh toán"],
	] as const)(
		"shows authoritative expired/%s state without a payment action",
		(paymentStatus, label) => {
			render(
				<BookingPaymentPanel
					booking={{ ...mockPendingBooking, status: "expired", paymentStatus }}
				/>
			);

			const status = screen.getByRole("status");
			expect(status).toHaveTextContent("Đơn đặt chỗ đã hết hạn");
			expect(status).toHaveTextContent(`Trạng thái thanh toán: ${label}`);
			expect(status).not.toHaveTextContent("xác nhận thành công");
			expect(screen.queryByRole("button", { name: "Thanh toán ngay" })).not.toBeInTheDocument();
		}
	);

	it("shows blocked alert for non-camper actor", () => {
		render(<BookingPaymentPanel booking={mockPendingBooking} bookingAccess="non-camper" />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Chỉ tài khoản Camper mới có quyền thanh toán cho đặt chỗ này."
		);
		expect(screen.queryByRole("button", { name: "Thanh toán ngay" })).not.toBeInTheDocument();
	});

	it("displays conflict error on 409", async () => {
		const paySpy = vi.spyOn(bookingPaymentService, "pay").mockRejectedValue(
			new HttpError("Conflict", 409, {
				message: "Booking has already been paid and confirmed",
			})
		);

		render(<BookingPaymentPanel booking={mockPendingBooking} />);

		await userEvent.click(screen.getByRole("button", { name: "Thanh toán ngay" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Booking has already been paid and confirmed"
		);

		paySpy.mockRestore();
	});

	it("displays retryable error and supports retrying on server failure", async () => {
		const successResult = {
			paymentId: "pay-retry-success",
			bookingId: mockPendingBooking.id,
			paymentStatus: "succeeded" as const,
			amount: "1000000.00",
			bookingStatus: "confirmed" as const,
			bookingPaymentStatus: "paid" as const,
			createdAt: "2026-09-29T10:30:00.000Z",
		};
		const paySpy = vi
			.spyOn(bookingPaymentService, "pay")
			.mockRejectedValueOnce(new HttpError("Server error", 500, {}))
			.mockResolvedValueOnce(successResult);

		render(<BookingPaymentPanel booking={mockPendingBooking} />);

		await userEvent.click(screen.getByRole("button", { name: "Thanh toán ngay" }));

		expect(await screen.findByRole("alert")).toBeInTheDocument();
		const retryBtn = screen.getByRole("button", { name: "Thử lại" });
		expect(retryBtn).toBeInTheDocument();

		await userEvent.click(retryBtn);

		expect(await screen.findByRole("status")).toHaveTextContent("Thanh toán thành công!");
		expect(screen.getByTestId("authoritative-payment-id")).toHaveTextContent("pay-retry-success");

		paySpy.mockRestore();
	});
});

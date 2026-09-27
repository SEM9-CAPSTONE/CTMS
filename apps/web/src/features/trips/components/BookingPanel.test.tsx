import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookTripResponse, TripDetails } from "../types";
import { BookingPanel } from "./BookingPanel";

const trip: Pick<
	TripDetails,
	"id" | "remainingSeats" | "isBookable" | "bookingDeadline" | "pricePerPerson"
> = {
	id: "trip-1",
	remainingSeats: 4,
	isBookable: true,
	bookingDeadline: "2099-01-01T00:00:00.000Z",
	pricePerPerson: 450000,
};

const booking: BookTripResponse = {
	id: "booking-authoritative-1",
	tripId: trip.id,
	userId: "user-1",
	numPeople: 2,
	status: "confirmed",
	paymentStatus: "not_required",
	holdExpiresAt: null,
	tripStartsAtSnapshot: "2099-01-05T01:00:00.000Z",
	tripEndsAtSnapshot: "2099-01-05T10:00:00.000Z",
	basePrice: "1234567.00",
	totalAmount: "1234567.00",
	cancellationPolicySnapshot: null,
	createdAt: "2099-01-01T01:00:00.000Z",
};

describe("BookingPanel", () => {
	it("renders anonymous and non-Camper access states without a submit action", () => {
		const { rerender } = render(<BookingPanel trip={trip} bookingAccess="anonymous" />);
		expect(screen.getByText(/đăng nhập bằng tài khoản Camper/i)).toBeVisible();
		expect(screen.queryByRole("button", { name: /đặt chỗ ngay/i })).not.toBeInTheDocument();

		rerender(<BookingPanel trip={trip} bookingAccess="non-camper" />);
		expect(screen.getByText(/không có quyền đặt chỗ/i)).toBeVisible();
		expect(screen.queryByRole("button", { name: /đặt chỗ ngay/i })).not.toBeInTheDocument();
	});

	it("submits a valid Camper selection", () => {
		const onBook = vi.fn();
		render(<BookingPanel trip={trip} onBook={onBook} />);
		fireEvent.change(screen.getByLabelText("Số lượng khách"), { target: { value: "2" } });
		fireEvent.click(screen.getByRole("button", { name: "Đặt chỗ ngay" }));
		expect(onBook).toHaveBeenCalledWith("trip-1", 2);
	});

	it.each([
		["", "Số lượng khách là bắt buộc"],
		["0", "Số lượng khách phải ít nhất là 1"],
		["1.5", "Số lượng khách phải là số nguyên"],
	])("renders accessible validation for %p", (value, message) => {
		render(<BookingPanel trip={trip} onBook={vi.fn()} />);
		const input = screen.getByLabelText("Số lượng khách");
		fireEvent.change(input, { target: { value } });
		fireEvent.click(screen.getByRole("button", { name: "Đặt chỗ ngay" }));
		expect(screen.getByRole("alert")).toHaveTextContent(message);
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
	});

	it("renders a backend field error beside the participant control", () => {
		render(<BookingPanel trip={trip} fieldErrors={{ numPeople: "Số lượng không hợp lệ" }} />);
		const input = screen.getByLabelText("Số lượng khách");
		expect(screen.getByRole("alert")).toHaveTextContent("Số lượng không hợp lệ");
		expect(input).toHaveAttribute("aria-invalid", "true");
	});

	it("disables submission and shows progress while booking", () => {
		render(<BookingPanel trip={trip} isBooking />);
		expect(screen.getByRole("button", { name: /đang xử lý đặt chỗ/i })).toBeDisabled();
	});

	it("distinguishes sold out, deadline, and generic unavailable states", () => {
		const { rerender } = render(<BookingPanel trip={{ ...trip, remainingSeats: 0 }} />);
		expect(screen.getByRole("button", { name: "Đã hết chỗ" })).toBeDisabled();

		rerender(<BookingPanel trip={{ ...trip, bookingDeadline: "2020-01-01T00:00:00.000Z" }} />);
		expect(screen.getByRole("button", { name: "Đã hết hạn đặt chỗ" })).toBeDisabled();

		rerender(<BookingPanel trip={{ ...trip, isBookable: false }} />);
		expect(
			screen.getByRole("button", { name: "Hiện không thể đặt chỗ cho chuyến đi này" })
		).toBeDisabled();
		expect(screen.queryByRole("button", { name: "Đã hết chỗ" })).not.toBeInTheDocument();
	});

	it("renders safe retry and disables it while retrying", () => {
		const onRetry = vi.fn();
		const { rerender } = render(
			<BookingPanel trip={trip} bookingError="Lỗi kết nối mạng" canRetry onRetry={onRetry} />
		);
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(onRetry).toHaveBeenCalledTimes(1);

		rerender(
			<BookingPanel
				trip={trip}
				bookingError="Lỗi kết nối mạng"
				canRetry
				onRetry={onRetry}
				isBooking
			/>
		);
		expect(screen.getByRole("button", { name: "Đang thử lại..." })).toBeDisabled();
	});

	it("shows an authoritative free Booking result without payment actions", () => {
		render(<BookingPanel trip={trip} booking={booking} />);
		const result = screen.getByRole("status");
		expect(result).toHaveTextContent("Đặt chỗ đã được xác nhận");
		expect(result).toHaveTextContent("confirmed");
		expect(result).toHaveTextContent("not_required");
		expect(result).toHaveTextContent("2");
		expect(screen.getByTestId("authoritative-booking-price")).toHaveTextContent(/1\.234\.567/);
		expect(screen.queryByText(/giữ chỗ đến/i)).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /thanh toán/i })).not.toBeInTheDocument();
	});

	it("shows authoritative pending-payment state and hold expiry", () => {
		render(
			<BookingPanel
				trip={trip}
				booking={{
					...booking,
					status: "pending_payment",
					paymentStatus: "unpaid",
					holdExpiresAt: "2099-01-01T01:15:00.000Z",
					basePrice: "900000.00",
				}}
			/>
		);
		const result = screen.getByRole("status");
		expect(result).toHaveTextContent("Đã tạo đặt chỗ thành công");
		expect(result).toHaveTextContent("pending_payment");
		expect(result).toHaveTextContent("unpaid");
		expect(result).toHaveTextContent("Giữ chỗ đến");
		expect(screen.getByTestId("authoritative-booking-price")).toHaveTextContent(/900\.000/);
		expect(screen.queryByText(/thanh toán thành công/i)).not.toBeInTheDocument();
	});
});

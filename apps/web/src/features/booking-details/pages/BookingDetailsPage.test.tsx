import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { bookingDetailsService } from "../services/booking-details.service";
import type { BookingDetails } from "../types";
import { BookingDetailsPage } from "./BookingDetailsPage";

vi.mock("../components/BookingDetailsView", () => ({
	BookingDetailsView: ({
		booking,
		onBack,
		backLabel,
	}: {
		booking: BookingDetails;
		onBack: () => void;
		backLabel?: string;
	}) => (
		<>
			<h1>Booking {booking.id}</h1>
			<button type="button" onClick={onBack}>
				{backLabel}
			</button>
		</>
	),
}));

const booking = { id: "booking-1" } as BookingDetails;

describe("BookingDetailsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(bookingDetailsService, "getBookingDetails");
	});

	it("renders semantic loading", () => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockReturnValue(new Promise(() => {}));
		render(<BookingDetailsPage bookingId="booking-1" onBack={vi.fn()} />);
		expect(screen.getByRole("status")).toHaveTextContent("Đang tải chi tiết đơn đặt chỗ");
	});

	it("renders success", async () => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(booking);
		const onBack = vi.fn();
		render(<BookingDetailsPage bookingId="booking-1" onBack={onBack} />);
		expect(await screen.findByRole("heading", { name: "Booking booking-1" })).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Quay lại đơn đặt chỗ" }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("uses the supplied Trip Detail return label", async () => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockResolvedValue(booking);
		render(
			<BookingDetailsPage
				bookingId="booking-1"
				onBack={vi.fn()}
				backLabel="Quay lại chi tiết chuyến đi"
			/>
		);
		expect(
			await screen.findByRole("button", { name: "Quay lại chi tiết chuyến đi" })
		).toBeVisible();
	});

	it.each([
		[403, "Không thể xem đơn đặt chỗ"],
		[404, "Không tìm thấy đơn đặt chỗ"],
		[422, "Mã đơn đặt chỗ không hợp lệ"],
	] as const)("renders HTTP %s", async (status, title) => {
		vi.mocked(bookingDetailsService.getBookingDetails).mockRejectedValue(
			new HttpError("request failed", status, {})
		);
		render(<BookingDetailsPage bookingId="booking-1" onBack={vi.fn()} />);
		expect(await screen.findByRole("alert")).toBeVisible();
		expect(screen.getByRole("heading", { name: title })).toBeVisible();
		expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
	});

	it("renders a retryable error and invokes retry", async () => {
		vi.mocked(bookingDetailsService.getBookingDetails)
			.mockRejectedValueOnce(new HttpError("unavailable", 503, {}))
			.mockResolvedValueOnce(booking);
		render(<BookingDetailsPage bookingId="booking-1" onBack={vi.fn()} />);
		fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
		expect(await screen.findByRole("heading", { name: "Booking booking-1" })).toBeVisible();
		expect(bookingDetailsService.getBookingDetails).toHaveBeenCalledTimes(2);
	});
});

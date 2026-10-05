import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookingListItem } from "../types";
import { BookingListView } from "./BookingListView";

const booking: BookingListItem = {
	id: "77777777-7777-4777-8777-777777777777",
	tripId: "33333333-3333-4333-8333-333333333333",
	numPeople: 2,
	status: "pending_payment",
	paymentStatus: "unpaid",
	holdExpiresAt: "2030-01-01T00:15:00.000Z",
	tripStartsAtSnapshot: "2030-02-01T01:00:00.000Z",
	tripEndsAtSnapshot: "2030-02-02T10:00:00.000Z",
	totalAmount: "1700000.00",
	createdAt: "2029-12-01T00:00:00.000Z",
	tripPresentation: {
		id: "33333333-3333-4333-8333-333333333333",
		currentTitle: "Summit Trip",
		routeId: "44444444-4444-4444-8444-444444444444",
		currentRouteName: "Ridge Route",
	},
};

describe("BookingListView", () => {
	it("renders accessible cards with authoritative summary values", () => {
		render(<BookingListView bookings={[booking]} onViewDetails={() => {}} />);
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		const list = screen.getByRole("list", { name: "Danh sách đơn đặt chỗ" });
		const card = within(list).getByRole("article");
		expect(within(card).getByText("Summit Trip")).toBeVisible();
		expect(within(card).getByText("Chờ thanh toán")).toBeVisible();
		expect(within(card).getByText("Chưa thanh toán")).toBeVisible();
		expect(within(card).getByText(booking.id, { exact: false })).toBeVisible();
		expect(within(card).getByText(/1\.700\.000/)).toBeVisible();
		expect(within(card).getByText("Lịch đi")).toBeVisible();
		expect(within(card).getByText("Số người")).toBeVisible();
		expect(within(card).getByText("Ngày tạo")).toBeVisible();
	});

	it("uses the neutral presentation fallback and opens details by stable Booking id", () => {
		const onViewDetails = vi.fn();
		render(
			<BookingListView
				bookings={[{ ...booking, tripPresentation: null }]}
				onViewDetails={onViewDetails}
			/>
		);
		expect(screen.getByText("Chuyến đi không còn thông tin hiển thị")).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
		expect(onViewDetails).toHaveBeenCalledWith(booking.id);
	});

	it("renders a clear empty state without a list", () => {
		render(<BookingListView bookings={[]} onViewDetails={() => {}} />);
		expect(screen.getByText("Bạn chưa có đơn đặt chỗ nào.")).toBeVisible();
		expect(screen.queryByRole("list")).not.toBeInTheDocument();
	});

	it("uses non-success styling for expired while confirmed remains successful", () => {
		render(
			<BookingListView
				bookings={[
					{ ...booking, id: "expired-booking", status: "expired" },
					{ ...booking, id: "confirmed-booking", status: "confirmed" },
				]}
				onViewDetails={() => {}}
			/>
		);

		const expired = screen.getByTestId("booking-status-expired-booking");
		const confirmed = screen.getByTestId("booking-status-confirmed-booking");
		expect(expired).toHaveTextContent("Đã hết hạn");
		expect(expired).toHaveClass("bg-rose-100", "text-rose-800");
		expect(expired).not.toHaveClass("bg-emerald-100");
		expect(confirmed).toHaveTextContent("Đã xác nhận");
		expect(confirmed).toHaveClass("bg-emerald-100", "text-emerald-900");
	});
});

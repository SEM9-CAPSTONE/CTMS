import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripDetails } from "../types";
import { TripDetailView } from "./TripDetailView";

const mockTripDetails: TripDetails = {
	id: "trip-999",
	hostId: "host-1",
	routeId: "secret-route-id-should-not-be-displayed",
	title: "Chinh Phục Đỉnh Núi Bidoup Trail",
	description: "Mô tả chi tiết chuyến đi Bidoup",
	coverImageUrl: "https://example.com/cover.jpg",
	itinerary: { summary: "2 ngày 1 đêm" },
	includes: { items: ["Lều trại", "Nước uống"] },
	excludes: { items: ["Balo cá nhân"] },
	tripType: "overnight",
	durationNights: 1,
	startsAt: "2026-09-28T06:00:00.000Z",
	endsAt: "2026-09-29T17:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.45, 11.94] },
	meetingAt: "2026-09-28T05:30:00.000Z",
	bookingDeadline: "2026-09-27T18:00:00.000Z",
	capacityMin: 8,
	capacityMax: 16,
	seatsTaken: 12,
	remainingSeats: 4,
	pricePerPerson: 1850000,
	cancellationPolicy: { policy: "Hủy trước 48h hoàn tiền 100%" },
	status: "published",
	difficulty: "moderate",
	weatherRiskLevel: "yellow",
	isBookable: true,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
	waypoints: [
		{
			id: "wp-2",
			tripId: "trip-999",
			checkpointId: null,
			type: "meal",
			name: "Bãi cắm trại Klong Klanh",
			location: { type: "Point", coordinates: [108.47, 11.96] },
			dayNumber: 1,
			sequenceOrder: 2,
			plannedAt: "2026-09-28T12:00:00.000Z",
			durationMinutes: 60,
			metadata: null,
		},
		{
			id: "wp-1",
			tripId: "trip-999",
			checkpointId: null,
			type: "start",
			name: "Trụ sở VQG",
			location: { type: "Point", coordinates: [108.45, 11.94] },
			dayNumber: 1,
			sequenceOrder: 1,
			plannedAt: "2026-09-28T06:00:00.000Z",
			durationMinutes: 30,
			metadata: null,
		},
	],
};

describe("TripDetailView", () => {
	it("renders comprehensive trip information, highlights, and waypoints", () => {
		const onBook = vi.fn();
		const onBack = vi.fn();

		render(<TripDetailView trip={mockTripDetails} onBook={onBook} onBack={onBack} />);

		expect(screen.getByText("Chinh Phục Đỉnh Núi Bidoup Trail")).toBeInTheDocument();
		expect(screen.getByText("Mô tả chi tiết chuyến đi Bidoup")).toBeInTheDocument();
		expect(screen.getAllByText("Thời tiết chú ý")[0]).toBeInTheDocument();
		expect(screen.getByText("Còn 4 chỗ")).toBeInTheDocument();
		expect(screen.getByText("Lều trại")).toBeInTheDocument();
		expect(screen.getByText("Balo cá nhân")).toBeInTheDocument();
		expect(screen.getByText("Hủy trước 48h hoàn tiền 100%")).toBeInTheDocument();

		// Waypoints rendered in sequence order
		expect(screen.getByText("Trụ sở VQG")).toBeInTheDocument();
		expect(screen.getByText("Bãi cắm trại Klong Klanh")).toBeInTheDocument();

		// Safe Camper view: secret routeId must not be displayed
		expect(screen.queryByText("secret-route-id-should-not-be-displayed")).not.toBeInTheDocument();

		// Booking button
		const bookBtn = screen.getByRole("button", { name: /đặt chỗ ngay/i });
		fireEvent.click(bookBtn);
		expect(onBook).toHaveBeenCalledWith("trip-999", 1);
	});

	it("adjusts participant count up to remainingSeats limit and updates total price", () => {
		const onBook = vi.fn();

		render(
			<TripDetailView
				trip={{ ...mockTripDetails, remainingSeats: 3, pricePerPerson: 1000000 }}
				onBook={onBook}
			/>
		);

		const numValue = screen.getByTestId("num-people-value");
		const totalPrice = screen.getByTestId("booking-total-price");
		expect(numValue).toHaveTextContent("1");
		expect(totalPrice).toHaveTextContent(/1\.000\.000/);

		const plusBtn = screen.getByRole("button", { name: "Tăng số lượng khách" });
		const minusBtn = screen.getByRole("button", { name: "Giảm số lượng khách" });

		// Increase to 2
		fireEvent.click(plusBtn);
		expect(numValue).toHaveTextContent("2");
		expect(totalPrice).toHaveTextContent(/2\.000\.000/);

		// Increase to 3 (limit)
		fireEvent.click(plusBtn);
		expect(numValue).toHaveTextContent("3");
		expect(totalPrice).toHaveTextContent(/3\.000\.000/);

		// Attempt increase beyond limit (3)
		fireEvent.click(plusBtn);
		expect(numValue).toHaveTextContent("3");
		expect(plusBtn).toBeDisabled();

		// Decrease back to 2
		fireEvent.click(minusBtn);
		expect(numValue).toHaveTextContent("2");

		// Book with 2 people
		fireEvent.click(screen.getByRole("button", { name: /đặt chỗ ngay/i }));
		expect(onBook).toHaveBeenCalledWith("trip-999", 2);
	});

	it("renders sold out state when remainingSeats is 0", () => {
		const soldOutTrip: TripDetails = {
			...mockTripDetails,
			remainingSeats: 0,
			isBookable: false,
		};

		render(<TripDetailView trip={soldOutTrip} />);

		expect(screen.getAllByText("Đã hết chỗ").length).toBeGreaterThanOrEqual(2);
		expect(screen.getByRole("button", { name: "Đã hết chỗ" })).toBeDisabled();
	});

	it("renders low capacity urgency banner when remainingSeats <= 3", () => {
		const lowSeatTrip: TripDetails = {
			...mockTripDetails,
			remainingSeats: 2,
		};

		render(<TripDetailView trip={lowSeatTrip} />);

		expect(screen.getByTestId("trip-capacity-banner-low-seats")).toBeInTheDocument();
		expect(screen.getByText("Chỉ còn 2 chỗ cuối cùng!")).toBeInTheDocument();
	});

	it("renders loading state on CTA when isBooking is true", () => {
		render(<TripDetailView trip={mockTripDetails} isBooking={true} />);

		const button = screen.getByRole("button", { name: /đang xử lý đặt chỗ/i });
		expect(button).toBeDisabled();
	});

	it("renders success state when isBookingSuccess is true", () => {
		render(<TripDetailView trip={mockTripDetails} isBookingSuccess={true} />);

		expect(screen.getByRole("status")).toHaveTextContent("Đặt chỗ thành công!");
	});

	it("renders inline error when bookingError is provided and isConflict is false", () => {
		render(
			<TripDetailView
				trip={mockTripDetails}
				bookingError="Thông tin đặt chỗ không hợp lệ"
				isConflict={false}
			/>
		);

		expect(screen.getByRole("alert")).toHaveTextContent("Thông tin đặt chỗ không hợp lệ");
	});

	it("renders BookingConflictDialog when isConflict is true and triggers reload/dismiss", () => {
		const onConflictDismiss = vi.fn();
		const onConflictReload = vi.fn();

		render(
			<TripDetailView
				trip={mockTripDetails}
				isConflict={true}
				bookingError="Chuyến đi đã hết chỗ trống do có người vừa đặt trước"
				onConflictDismiss={onConflictDismiss}
				onConflictReload={onConflictReload}
			/>
		);

		expect(screen.getByTestId("booking-conflict-dialog")).toBeInTheDocument();
		expect(
			screen.getByText("Chuyến đi đã hết chỗ trống do có người vừa đặt trước")
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /tải lại dữ liệu/i }));
		expect(onConflictReload).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
		expect(onConflictDismiss).toHaveBeenCalledTimes(1);
	});

	it("renders safety warning for red weather risk level", () => {
		const redRiskTrip: TripDetails = {
			...mockTripDetails,
			weatherRiskLevel: "red",
		};

		render(<TripDetailView trip={redRiskTrip} />);

		expect(screen.getByText("Lưu ý an toàn thời tiết:")).toBeInTheDocument();
		expect(screen.getAllByText("Cảnh báo rủi ro cao")[0]).toBeInTheDocument();
	});
});

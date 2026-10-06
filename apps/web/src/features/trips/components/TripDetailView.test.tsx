import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TripDetails } from "../types";
import { TripDetailView } from "./TripDetailView";

vi.mock("../../booking-equipment/components/BookingEquipmentPicker", () => ({
	BookingEquipmentPicker: ({
		bookingId,
		onEquipmentChanged,
	}: {
		bookingId: string;
		onEquipmentChanged?: () => void;
	}) => (
		<div data-testid="booking-equipment-picker">
			{bookingId}
			<button type="button" onClick={onEquipmentChanged}>
				simulate-equipment-change
			</button>
		</div>
	),
}));

vi.mock("../../booking-members/components/InitializeBookingMembersPanel", () => ({
	InitializeBookingMembersPanel: ({
		booking,
		confirmedRoster,
	}: {
		booking: { id: string };
		confirmedRoster?: { members: unknown[] } | null;
	}) => (
		<div data-testid="booking-members-panel">
			{booking.id}:{confirmedRoster ? `confirmed-${confirmedRoster.members.length}` : "editable"}
		</div>
	),
}));

vi.mock("../../booking-payment/components/BookingPaymentPanel", () => ({
	BookingPaymentPanel: ({ booking }: { booking: { id: string } }) => (
		<div data-testid="booking-payment-panel">{booking.id}</div>
	),
}));

vi.mock("../../packing-list/components/PackingListPanel", () => ({
	PackingListPanel: ({ bookingId, refreshKey }: { bookingId: string; refreshKey?: unknown }) => (
		<div data-testid="packing-list-panel" data-refresh-key={String(refreshKey)}>
			{bookingId}
		</div>
	),
}));

vi.mock("../../packing-list/components/PackingListModal", () => ({
	PackingListModal: ({
		isOpen,
		bookingId,
		refreshKey,
	}: {
		isOpen: boolean;
		onClose: () => void;
		bookingId: string;
		refreshKey?: unknown;
	}) => (
		<div data-testid="packing-list-modal" data-is-open={String(isOpen)}>
			<div data-testid="packing-list-panel" data-refresh-key={String(refreshKey)}>
				{bookingId}
			</div>
		</div>
	),
}));

vi.mock("./TripRentableEquipment", () => ({
	TripRentableEquipment: ({
		tripId,
		onConfirmSelection,
	}: {
		tripId: string;
		onConfirmSelection?: (selected: unknown[]) => void;
	}) => (
		<div data-testid="trip-rentable-equipment">
			{tripId}
			<button
				type="button"
				onClick={() =>
					onConfirmSelection?.([
						{
							item: {
								id: "eq-1",
								name: "Lều",
								rentalPricePerDay: 50000,
								quantityTotal: 5,
							},
							quantity: 2,
						},
					])
				}
			>
				select-mock-equipment
			</button>
		</div>
	),
}));

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
	startsAt: "2099-09-28T06:00:00.000Z",
	endsAt: "2099-09-29T17:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.45, 11.94] },
	meetingAt: "2099-09-28T05:30:00.000Z",
	bookingDeadline: "2099-09-27T18:00:00.000Z",
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
			plannedAt: "2099-09-28T12:00:00.000Z",
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
			plannedAt: "2099-09-28T06:00:00.000Z",
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
		expect(numValue).toHaveValue(1);
		expect(totalPrice).toHaveTextContent(/1\.000\.000/);

		const plusBtn = screen.getByRole("button", { name: "Tăng số lượng khách" });
		const minusBtn = screen.getByRole("button", { name: "Giảm số lượng khách" });

		// Increase to 2
		fireEvent.click(plusBtn);
		expect(numValue).toHaveValue(2);
		expect(totalPrice).toHaveTextContent(/2\.000\.000/);

		// Increase to 3 (limit)
		fireEvent.click(plusBtn);
		expect(numValue).toHaveValue(3);
		expect(totalPrice).toHaveTextContent(/3\.000\.000/);

		// Attempt increase beyond limit (3)
		fireEvent.click(plusBtn);
		expect(numValue).toHaveValue(3);
		expect(plusBtn).toBeDisabled();

		// Decrease back to 2
		fireEvent.click(minusBtn);
		expect(numValue).toHaveValue(2);

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

	it("renders the authoritative booking success state", () => {
		render(
			<TripDetailView
				trip={mockTripDetails}
				booking={{
					id: "booking-1",
					tripId: mockTripDetails.id,
					userId: "user-1",
					numPeople: 1,
					status: "confirmed",
					paymentStatus: "not_required",
					holdExpiresAt: null,
					tripStartsAtSnapshot: mockTripDetails.startsAt,
					tripEndsAtSnapshot: mockTripDetails.endsAt,
					basePrice: "1000000.00",
					totalAmount: "1000000.00",
					cancellationPolicySnapshot: null,
					createdAt: "2026-09-20T12:00:00.000Z",
				}}
			/>
		);

		expect(screen.getByRole("status")).toHaveTextContent("Đặt chỗ đã được xác nhận");
	});

	it("does not render post-booking panels before a Booking exists", () => {
		render(<TripDetailView trip={mockTripDetails} />);

		expect(screen.queryByTestId("booking-payment-panel")).not.toBeInTheDocument();
	});

	it("renders post-booking panels for the created Booking after success without sidebar equipment picker", () => {
		render(
			<TripDetailView
				trip={mockTripDetails}
				booking={{
					id: "booking-1",
					tripId: "trip-999",
					userId: "user-1",
					numPeople: 2,
					status: "confirmed",
					paymentStatus: "not_required",
					holdExpiresAt: null,
					tripStartsAtSnapshot: "2026-09-28T06:00:00.000Z",
					tripEndsAtSnapshot: "2026-09-29T17:00:00.000Z",
					basePrice: "3700000.00",
					totalAmount: "3700000.00",
					cancellationPolicySnapshot: null,
					createdAt: "2026-09-27T00:00:00.000Z",
				}}
			/>
		);

		expect(screen.queryByTestId("booking-equipment-picker")).not.toBeInTheDocument();
		expect(screen.getByTestId("booking-members-panel")).toHaveTextContent("booking-1");
		expect(screen.getByTestId("booking-payment-panel")).toHaveTextContent("booking-1");
	});

	it("bumps the packing list refresh key when equipment is confirmed", () => {
		render(
			<TripDetailView
				trip={mockTripDetails}
				booking={{
					id: "booking-1",
					tripId: "trip-999",
					userId: "user-1",
					numPeople: 2,
					status: "confirmed",
					paymentStatus: "not_required",
					holdExpiresAt: null,
					tripStartsAtSnapshot: "2026-09-28T06:00:00.000Z",
					tripEndsAtSnapshot: "2026-09-29T17:00:00.000Z",
					basePrice: "3700000.00",
					totalAmount: "3700000.00",
					cancellationPolicySnapshot: null,
					createdAt: "2026-09-27T00:00:00.000Z",
				}}
			/>
		);

		const before = screen.getByTestId("packing-list-panel").getAttribute("data-refresh-key");
		fireEvent.click(screen.getByRole("button", { name: "select-mock-equipment" }));
		const after = screen.getByTestId("packing-list-panel").getAttribute("data-refresh-key");

		expect(after).not.toBe(before);
	});

	it("uses the authoritative confirmed roster restored from Booking Details", () => {
		const booking = {
			id: "booking-1",
			tripId: "trip-999",
			userId: "user-1",
			numPeople: 2,
			status: "confirmed" as const,
			paymentStatus: "not_required" as const,
			holdExpiresAt: null,
			tripStartsAtSnapshot: "2026-09-28T06:00:00.000Z",
			tripEndsAtSnapshot: "2026-09-29T17:00:00.000Z",
			basePrice: "3700000.00",
			totalAmount: "3700000.00",
			cancellationPolicySnapshot: null,
			createdAt: "2026-09-27T00:00:00.000Z",
		};
		render(
			<TripDetailView
				trip={mockTripDetails}
				booking={booking}
				restoredBookingDetails={{
					...booking,
					tripPresentation: null,
					members: [
						{
							id: "member-1",
							userId: "user-1",
							email: "owner@example.com",
							isPrimary: true,
							memberStatus: "registered",
							createdAt: "x",
							updatedAt: "x",
						},
						{
							id: "member-2",
							userId: "user-2",
							email: "member@example.com",
							isPrimary: false,
							memberStatus: "registered",
							createdAt: "x",
							updatedAt: "x",
						},
					],
					equipmentItems: [],
				}}
			/>
		);

		expect(screen.getByTestId("booking-members-panel")).toHaveTextContent("confirmed-2");
	});

	it("forwards the Booking details callback from the success UI", () => {
		const onViewBookingDetails = vi.fn();
		render(
			<TripDetailView
				trip={mockTripDetails}
				booking={{
					id: "booking-1",
					tripId: "trip-999",
					userId: "user-1",
					numPeople: 1,
					status: "confirmed",
					paymentStatus: "not_required",
					holdExpiresAt: null,
					tripStartsAtSnapshot: mockTripDetails.startsAt,
					tripEndsAtSnapshot: mockTripDetails.endsAt,
					basePrice: "1000000.00",
					totalAmount: "1000000.00",
					cancellationPolicySnapshot: null,
					createdAt: "2026-09-27T00:00:00.000Z",
				}}
				onViewBookingDetails={onViewBookingDetails}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết đặt chỗ" }));
		expect(onViewBookingDetails).toHaveBeenCalledWith("booking-1");
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

	it("renders gallery controls and switches images when multiple images exist", () => {
		const tripWithGallery: TripDetails = {
			...mockTripDetails,
			coverImageUrl: "https://example.com/cover1.jpg",
			itinerary: {
				summary: "2 ngày 1 đêm",
				images: ["https://example.com/gallery1.jpg", "https://example.com/gallery2.jpg"],
			},
		};

		render(<TripDetailView trip={tripWithGallery} />);

		// Counter shows 1 / 3
		expect(screen.getByText("1 / 3")).toBeInTheDocument();

		// Click Next button
		const nextBtn = screen.getByRole("button", { name: "Hình kế tiếp" });
		fireEvent.click(nextBtn);
		expect(screen.getByText("2 / 3")).toBeInTheDocument();

		// Click Prev button
		const prevBtn = screen.getByRole("button", { name: "Hình trước" });
		fireEvent.click(prevBtn);
		expect(screen.getByText("1 / 3")).toBeInTheDocument();

		// Click to open lightbox
		const openLightboxBtn = screen.getByRole("button", { name: "Xem ảnh phóng to" });
		fireEvent.click(openLightboxBtn);

		const lightbox = screen.getByTestId("trip-image-lightbox");
		expect(lightbox).toBeInTheDocument();

		// Close lightbox via close button
		const closeBtn = screen.getByRole("button", { name: "Đóng thư viện hình ảnh" });
		fireEvent.click(closeBtn);
		expect(screen.queryByTestId("trip-image-lightbox")).not.toBeInTheDocument();
	});

	it("forwards pre-selected equipment items when booking is submitted", () => {
		const onBook = vi.fn();
		render(<TripDetailView trip={mockTripDetails} onBook={onBook} />);

		// Simulate selecting equipment
		fireEvent.click(screen.getByRole("button", { name: "select-mock-equipment" }));

		// Total price updates: base (1,850,000) + equipment (50,000 * 2 = 100,000) = 1,950,000
		expect(screen.getByTestId("booking-total-price")).toHaveTextContent("1.950.000");

		// Submit booking
		fireEvent.click(screen.getByRole("button", { name: /đặt chỗ ngay/i }));
		expect(onBook).toHaveBeenCalledWith(
			"trip-999",
			1,
			expect.arrayContaining([
				expect.objectContaining({
					quantity: 2,
				}),
			])
		);
	});
});

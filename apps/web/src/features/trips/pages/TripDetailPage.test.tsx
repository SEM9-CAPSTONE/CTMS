import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookTrip } from "../hooks/useBookTrip";
import { useTripDetail } from "../hooks/useTripDetail";
import type { TripDetails } from "../types";
import { TripDetailPage } from "./TripDetailPage";

vi.mock("../hooks/useTripDetail", () => ({
	useTripDetail: vi.fn(),
}));

vi.mock("../hooks/useBookTrip", () => ({
	useBookTrip: vi.fn(),
}));

vi.mock("../../booking-equipment/components/BookingEquipmentPicker", () => ({
	BookingEquipmentPicker: ({ bookingId }: { bookingId: string }) => (
		<div data-testid="booking-equipment-picker">{bookingId}</div>
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

const mockTrip: TripDetails = {
	id: "trip-abc",
	hostId: "host-1",
	title: "Chinh Phục Đỉnh Núi Bidoup",
	description: "Mô tả hành trình",
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "overnight",
	durationNights: 1,
	startsAt: "2099-09-28T06:00:00.000Z",
	endsAt: "2099-09-29T17:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.45, 11.94] },
	meetingAt: null,
	bookingDeadline: "2099-09-26T23:00:00.000Z",
	capacityMin: 8,
	capacityMax: 16,
	seatsTaken: 10,
	remainingSeats: 6,
	pricePerPerson: 1850000,
	cancellationPolicy: null,
	status: "published",
	difficulty: "moderate",
	weatherRiskLevel: "green",
	isBookable: true,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
	waypoints: [],
};

const defaultBookTripState = {
	book: vi.fn(),
	retry: vi.fn(),
	clearConflict: vi.fn(),
	reset: vi.fn(),
	isBooking: false,
	isSuccess: false,
	booking: null,
	error: null,
	fieldErrors: {},
	isConflict: false,
	canRetry: false,
	lastInput: null,
};

describe("TripDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useBookTrip).mockReturnValue({ ...defaultBookTripState });
	});

	it("renders loading state", () => {
		vi.mocked(useTripDetail).mockReturnValue({
			trip: null,
			isLoading: true,
			error: null,
			isNotFound: false,
			retry: vi.fn(),
		});

		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} />);

		expect(screen.getByTestId("trip-detail-loading")).toBeInTheDocument();
	});

	it("renders not found state", () => {
		vi.mocked(useTripDetail).mockReturnValue({
			trip: null,
			isLoading: false,
			error: "Chuyến đi không tồn tại hoặc đã kết thúc.",
			isNotFound: true,
			retry: vi.fn(),
		});

		const onBackToList = vi.fn();
		render(<TripDetailPage tripId="invalid-id" onBackToList={onBackToList} />);

		expect(screen.getByTestId("trip-not-found")).toBeInTheDocument();
		expect(screen.getByText("Chuyến đi không tồn tại hoặc đã kết thúc")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Xem các chuyến đi khác" }));
		expect(onBackToList).toHaveBeenCalled();
	});

	it("renders error state and triggers retry", () => {
		const retryMock = vi.fn();
		vi.mocked(useTripDetail).mockReturnValue({
			trip: null,
			isLoading: false,
			error: "Không thể tải thông tin chuyến đi. Vui lòng thử lại.",
			isNotFound: false,
			retry: retryMock,
		});

		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} />);

		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải thông tin chuyến đi");

		fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
		expect(retryMock).toHaveBeenCalled();
	});

	it("renders trip detail content and allows navigating back", () => {
		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: vi.fn(),
		});

		const onBackToList = vi.fn();
		const onBackHome = vi.fn();

		render(
			<TripDetailPage tripId="trip-abc" onBackToList={onBackToList} onBackHome={onBackHome} />
		);

		expect(screen.getByText("Chinh Phục Đỉnh Núi Bidoup")).toBeInTheDocument();

		fireEvent.click(screen.getAllByRole("button", { name: "Quay lại danh sách chuyến đi" })[0]);
		expect(onBackToList).toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Trang chủ" }));
		expect(onBackHome).toHaveBeenCalled();
	});

	it("delegates to onBook prop when provided", async () => {
		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: vi.fn(),
		});

		const onBook = vi.fn();
		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} onBook={onBook} />);

		fireEvent.click(screen.getByRole("button", { name: /đặt chỗ ngay/i }));
		expect(onBook).toHaveBeenCalledWith("trip-abc", 1);
	});

	it("uses useBookTrip and re-fetches trip on booking success", async () => {
		const retryTripDetail = vi.fn();
		const bookMock = vi.fn().mockResolvedValueOnce({
			id: "booking-1",
			tripId: "trip-abc",
			numPeople: 1,
			status: "confirmed",
		});

		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: retryTripDetail,
		});

		vi.mocked(useBookTrip).mockReturnValue({
			...defaultBookTripState,
			book: bookMock,
		});

		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} />);

		fireEvent.click(screen.getByRole("button", { name: /đặt chỗ ngay/i }));
		expect(bookMock).toHaveBeenCalledWith({ tripId: "trip-abc", numPeople: 1 });
		await vi.waitFor(() => {
			expect(retryTripDetail).toHaveBeenCalled();
		});
	});

	it("renders capacity from the authoritative Trip refresh after Booking success (BR-264)", async () => {
		const refreshedTrip = {
			...mockTrip,
			seatsTaken: 11,
			remainingSeats: 5,
			updatedAt: "2026-09-27T01:00:00.000Z",
		};
		vi.mocked(useTripDetail).mockImplementation(function useAuthoritativeTripDetail() {
			const [trip, setTrip] = useState(mockTrip);
			return {
				trip,
				isLoading: false,
				error: null,
				isNotFound: false,
				retry: async () => setTrip(refreshedTrip),
			};
		});
		vi.mocked(useBookTrip).mockReturnValue({
			...defaultBookTripState,
			book: vi.fn().mockResolvedValueOnce({ id: "booking-1" }),
		});

		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} />);
		expect(screen.getByTestId("trip-remaining-seats")).toHaveTextContent("6 chỗ");

		fireEvent.click(screen.getByRole("button", { name: /đặt chỗ ngay/i }));

		await vi.waitFor(() => {
			expect(screen.getByTestId("trip-remaining-seats")).toHaveTextContent("5 chỗ");
		});
	});

	it("passes the authoritative Booking response through to the result UI", () => {
		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: vi.fn(),
		});
		vi.mocked(useBookTrip).mockReturnValue({
			...defaultBookTripState,
			isSuccess: true,
			booking: {
				id: "booking-page-1",
				tripId: mockTrip.id,
				userId: "camper-1",
				numPeople: 2,
				status: "pending_payment",
				paymentStatus: "unpaid",
				holdExpiresAt: "2026-09-26T12:15:00.000Z",
				tripStartsAtSnapshot: mockTrip.startsAt,
				tripEndsAtSnapshot: mockTrip.endsAt,
				basePrice: "765432.00",
				totalAmount: "765432.00",
				cancellationPolicySnapshot: null,
				createdAt: "2026-09-26T12:00:00.000Z",
			},
		});

		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} />);

		expect(screen.getByRole("status")).toHaveTextContent("pending_payment");
		expect(screen.getByTestId("authoritative-booking-price")).toHaveTextContent(/765\.432/);
	});

	it("passes Booking detail navigation through the page", () => {
		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: vi.fn(),
		});
		vi.mocked(useBookTrip).mockReturnValue({
			...defaultBookTripState,
			booking: {
				id: "booking-page-1",
				tripId: mockTrip.id,
				userId: "camper-1",
				numPeople: 1,
				status: "confirmed",
				paymentStatus: "not_required",
				holdExpiresAt: null,
				tripStartsAtSnapshot: mockTrip.startsAt,
				tripEndsAtSnapshot: mockTrip.endsAt,
				basePrice: "100000.00",
				totalAmount: "100000.00",
				cancellationPolicySnapshot: null,
				createdAt: "2026-09-26T12:00:00.000Z",
			},
		});
		const onViewBookingDetails = vi.fn();
		render(
			<TripDetailPage
				tripId="trip-abc"
				onBackToList={vi.fn()}
				onViewBookingDetails={onViewBookingDetails}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết đặt chỗ" }));
		expect(onViewBookingDetails).toHaveBeenCalledWith("booking-page-1");
	});

	it("restores an authoritative Booking after returning from a refreshed detail route", () => {
		const book = vi.fn();
		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: vi.fn(),
		});
		vi.mocked(useBookTrip).mockReturnValue({ ...defaultBookTripState, book });

		render(
			<TripDetailPage
				tripId={mockTrip.id}
				onBackToList={vi.fn()}
				restoredBookingDetails={{
					id: "booking-restored",
					tripId: mockTrip.id,
					userId: "camper-1",
					numPeople: 2,
					status: "confirmed",
					paymentStatus: "not_required",
					holdExpiresAt: null,
					tripStartsAtSnapshot: mockTrip.startsAt,
					tripEndsAtSnapshot: mockTrip.endsAt,
					basePrice: "3700000.00",
					totalAmount: "3700000.00",
					cancellationPolicySnapshot: null,
					createdAt: "2026-09-27T00:00:00.000Z",
					tripPresentation: null,
					members: [],
					equipmentItems: [],
				}}
			/>
		);

		expect(screen.getAllByText("booking-restored").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByRole("button", { name: /đặt chỗ ngay/i })).not.toBeInTheDocument();
		expect(book).not.toHaveBeenCalled();
	});

	it("displays conflict dialog and reloads authoritative state on conflict reload (BR-210)", () => {
		const retryTripDetail = vi.fn();
		const clearConflict = vi.fn();

		vi.mocked(useTripDetail).mockReturnValue({
			trip: mockTrip,
			isLoading: false,
			error: null,
			isNotFound: false,
			retry: retryTripDetail,
		});

		vi.mocked(useBookTrip).mockReturnValue({
			...defaultBookTripState,
			isConflict: true,
			error: "Chuyến đi không còn đủ chỗ trống do vừa có người đặt trước.",
			clearConflict,
		});

		render(<TripDetailPage tripId="trip-abc" onBackToList={vi.fn()} />);

		expect(screen.getByTestId("booking-conflict-dialog")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /tải lại dữ liệu/i }));
		expect(clearConflict).toHaveBeenCalled();
		expect(retryTripDetail).toHaveBeenCalled();
	});
});

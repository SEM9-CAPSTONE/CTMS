import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMyTrips } from "../hooks/useMyTrips";
import type { TripDetails } from "../types";
import { HostCampersPage } from "./HostCampersPage";

vi.mock("../hooks/useMyTrips", () => ({
	useMyTrips: vi.fn(),
}));

vi.mock("../components/HostTripBookingsView", () => ({
	HostTripBookingsView: ({ tripId }: { tripId: string }) => (
		<div data-testid="host-trip-bookings-view">Bookings for trip {tripId}</div>
	),
}));

function createMockTrip(overrides: Partial<TripDetails>): TripDetails {
	return {
		id: "trip-1",
		hostId: "host-1",
		routeId: "route-1",
		title: "Chuyến đi mẫu",
		description: null,
		coverImageUrl: null,
		itinerary: null,
		includes: null,
		excludes: null,
		tripType: "day_trip",
		durationNights: 1,
		startsAt: "2026-11-01T06:00:00.000Z",
		endsAt: "2026-11-03T18:00:00.000Z",
		meetingPoint: { type: "Point", coordinates: [105.8, 21.0] },
		meetingAt: null,
		bookingDeadline: "2026-10-25T00:00:00.000Z",
		capacityMin: 5,
		capacityMax: 20,
		seatsTaken: 12,
		remainingSeats: 8,
		pricePerPerson: 2500000,
		cancellationPolicy: null,
		status: "published",
		cancellationReason: null,
		cancelledAt: null,
		isBookable: true,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		waypoints: [],
		...overrides,
	};
}

const mockTrips: TripDetails[] = [
	createMockTrip({
		id: "trip-published-1",
		title: "Trekking Fansipan 3N2D",
		status: "published",
		startsAt: "2026-11-01T06:00:00.000Z",
		endsAt: "2026-11-03T18:00:00.000Z",
		seatsTaken: 12,
		capacityMax: 20,
		pricePerPerson: 2500000,
		hostId: "host-1",
		routeId: "route-1",
		bookingDeadline: "2026-10-25T00:00:00.000Z",
		coverImageUrl: "https://example.com/cover.jpg",
	}),
	createMockTrip({
		id: "trip-ongoing-2",
		title: "Trekking Bidoup Núi Bà",
		status: "ongoing",
		startsAt: "2026-10-18T06:00:00.000Z",
		endsAt: "2026-10-20T18:00:00.000Z",
		seatsTaken: 15,
		capacityMax: 15,
		pricePerPerson: 1800000,
		hostId: "host-1",
		routeId: "route-2",
		bookingDeadline: "2026-10-10T00:00:00.000Z",
	}),
	createMockTrip({
		id: "trip-draft-3",
		title: "Khám phá Sơn Trà bí ẩn",
		status: "draft",
		startsAt: "2026-12-01T07:00:00.000Z",
		endsAt: "2026-12-02T17:00:00.000Z",
		seatsTaken: 0,
		capacityMax: 10,
		pricePerPerson: 900000,
		hostId: "host-1",
		routeId: "route-3",
		bookingDeadline: "2026-11-25T00:00:00.000Z",
	}),
];

describe("HostCampersPage", () => {
	const refetchMock = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useMyTrips).mockReturnValue({
			trips: mockTrips,
			isLoading: false,
			error: "",
			refetch: refetchMock,
		});
	});

	it("renders loading state when trips are loading", () => {
		vi.mocked(useMyTrips).mockReturnValue({
			trips: [],
			isLoading: true,
			error: "",
			refetch: refetchMock,
		});

		render(<HostCampersPage />);
		expect(screen.getByText("Đang tải danh sách chuyến đi...")).toBeInTheDocument();
	});

	it("renders error state when fetching trips fails and retries on button click", () => {
		vi.mocked(useMyTrips).mockReturnValue({
			trips: [],
			isLoading: false,
			error: "Lỗi kết nối máy chủ",
			refetch: refetchMock,
		});

		render(<HostCampersPage />);
		expect(screen.getByText("Không thể tải danh sách chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("Lỗi kết nối máy chủ")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(refetchMock).toHaveBeenCalledTimes(1);
	});

	it("renders empty state when host has 0 trips and allows creating trip", () => {
		vi.mocked(useMyTrips).mockReturnValue({
			trips: [],
			isLoading: false,
			error: "",
			refetch: refetchMock,
		});

		const createTripMock = vi.fn();
		render(<HostCampersPage onCreateTrip={createTripMock} />);

		expect(screen.getByText("Chưa có chuyến đi nào")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Tạo chuyến đi mới" }));
		expect(createTripMock).toHaveBeenCalledTimes(1);
	});

	it("renders trip selector and auto-selects preferred trip", () => {
		render(<HostCampersPage />);

		expect(screen.getByRole("heading", { name: "Người tham gia & đặt chỗ" })).toBeInTheDocument();
		expect(screen.getAllByText("Trekking Fansipan 3N2D").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Trekking Bidoup Núi Bà").length).toBeGreaterThanOrEqual(1);

		// Preferred trip (ongoing or published) is selected:
		expect(screen.getByTestId("host-trip-bookings-view")).toHaveTextContent(
			"Bookings for trip trip-published-1"
		);
	});

	it("pre-selects initialTripId when provided", () => {
		render(<HostCampersPage initialTripId="trip-published-1" />);

		expect(screen.getByTestId("host-trip-bookings-view")).toHaveTextContent(
			"Bookings for trip trip-published-1"
		);
	});

	it("switches selected trip when another trip is clicked", () => {
		render(<HostCampersPage initialTripId="trip-published-1" />);

		expect(screen.getByTestId("host-trip-bookings-view")).toHaveTextContent(
			"Bookings for trip trip-published-1"
		);

		fireEvent.click(screen.getByRole("button", { name: /Trekking Bidoup Núi Bà/i }));
		expect(screen.getByTestId("host-trip-bookings-view")).toHaveTextContent(
			"Bookings for trip trip-ongoing-2"
		);
	});

	it("shows draft notice instead of roster when selected trip is a draft", () => {
		render(<HostCampersPage initialTripId="trip-draft-3" />);

		expect(screen.queryByTestId("host-trip-bookings-view")).not.toBeInTheDocument();
		expect(screen.getByText(/Chuyến đi này hiện ở trạng thái Bản nháp/i)).toBeInTheDocument();
	});

	it("filters trips by search query", () => {
		render(<HostCampersPage />);

		const searchInput = screen.getByPlaceholderText("Tìm theo tên chuyến đi...");
		fireEvent.change(searchInput, { target: { value: "Fansipan" } });

		expect(screen.getAllByText("Trekking Fansipan 3N2D").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText("Trekking Bidoup Núi Bà")).not.toBeInTheDocument();
	});

	it("navigates to trip detail when button is clicked", () => {
		const navigateMock = vi.fn();
		render(
			<HostCampersPage initialTripId="trip-published-1" onNavigateToTripDetail={navigateMock} />
		);

		fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết chuyến/i }));
		expect(navigateMock).toHaveBeenCalledWith("trip-published-1");
	});

	it("calls refetch when refresh button is clicked", () => {
		render(<HostCampersPage />);

		fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
		expect(refetchMock).toHaveBeenCalledTimes(1);
	});
});

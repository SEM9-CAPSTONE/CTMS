import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyTrips } from "../../trips/hooks/useMyTrips";
import type { TripDetails } from "../../trips/types";
import { HostMyTripsPanel } from "./HostMyTripsPanel";

vi.mock("../../trips/hooks/useMyTrips", () => ({
	useMyTrips: vi.fn(),
}));

vi.mock("../../trips/hooks/useTripReviewNotifications", () => ({
	useHostTripReviewNotifications: vi.fn(),
}));

const mockUseMyTrips = vi.mocked(useMyTrips);

const sampleTrip1: TripDetails = {
	id: "trip-1",
	hostId: "host-1",
	title: "Sơn Trà Trekking Discovery",
	description: "Trekking Sơn Trà",
	coverImageUrl: "https://example.com/sontra.jpg",
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2026-10-01T06:00:00.000Z",
	endsAt: "2026-10-01T14:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.25, 16.1] },
	meetingAt: "2026-10-01T05:30:00.000Z",
	bookingDeadline: "2026-09-30T12:00:00.000Z",
	capacityMin: 5,
	capacityMax: 15,
	seatsTaken: 3,
	remainingSeats: 12,
	pricePerPerson: 550000,
	cancellationPolicy: null,
	status: "published",
	cancellationReason: null,
	cancelledAt: null,
	difficulty: "moderate",
	weatherRiskLevel: "green",
	isBookable: true,
	createdAt: "2026-09-20T00:00:00.000Z",
	updatedAt: "2026-09-20T00:00:00.000Z",
	waypoints: [],
};

const sampleTrip2: TripDetails = {
	...sampleTrip1,
	id: "trip-2",
	title: "Bidoup Núi Bà Chinh Phục",
	status: "draft",
};

const sampleTrip3: TripDetails = {
	...sampleTrip1,
	id: "trip-3",
	title: "Langbiang chờ duyệt",
	status: "pending_approval",
};

const trackedStatusTrips: TripDetails[] = [
	{ ...sampleTrip1, id: "trip-published", title: "Chuyến đang mở bán", status: "published" },
	{ ...sampleTrip1, id: "trip-ongoing", title: "Chuyến đang diễn ra", status: "ongoing" },
	{ ...sampleTrip1, id: "trip-completed", title: "Chuyến đã kết thúc", status: "completed" },
	{ ...sampleTrip1, id: "trip-rejected", title: "Chuyến từ chối", status: "rejected" },
];

describe("HostMyTripsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-29T00:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("filters past trips as completed and departed trips as ongoing", () => {
		vi.setSystemTime(new Date("2026-10-15T00:00:00.000Z"));
		mockUseMyTrips.mockReturnValue({
			trips: [
				{ ...sampleTrip1, title: "Past trip" },
				{
					...sampleTrip1,
					id: "started",
					title: "Already started",
					startsAt: "2026-10-15T07:00:00+07:00",
					endsAt: "2026-10-15T14:00:00+07:00",
				},
				{
					...sampleTrip1,
					id: "future",
					title: "Future trip",
					startsAt: "2026-10-17T00:00:00.000Z",
					endsAt: "2026-10-17T14:00:00.000Z",
					bookingDeadline: "2026-10-16T00:00:00.000Z",
				},
			],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});
		render(<HostMyTripsPanel />);
		fireEvent.click(screen.getByRole("button", { name: /Đang mở bán\s*1/ }));
		expect(screen.getByText("Future trip")).toBeInTheDocument();
		expect(screen.queryByText("Past trip")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Đang diễn ra\s*1/ }));
		expect(screen.getByText("Already started")).toBeInTheDocument();
		expect(screen.queryByText("Future trip")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Kết thúc\s*1/ }));
		expect(screen.getByText("Past trip")).toBeInTheDocument();
		expect(screen.queryByText("Already started")).not.toBeInTheDocument();
		expect(screen.queryByText("Đã đóng đăng ký")).not.toBeInTheDocument();
	});

	it("advances from published to ongoing to completed while the page remains open", () => {
		vi.setSystemTime(new Date("2026-10-01T05:59:59.000Z"));
		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});
		render(<HostMyTripsPanel />);
		expect(screen.getByRole("button", { name: /Đang mở bán\s*1/ })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1000));
		expect(screen.getByRole("button", { name: /Đang mở bán\s*0/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Đang diễn ra\s*1/ })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(8 * 60 * 60 * 1000));
		expect(screen.getByRole("button", { name: /Đang diễn ra\s*0/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Kết thúc\s*1/ })).toBeInTheDocument();
	});

	it("renders loading state", () => {
		mockUseMyTrips.mockReturnValue({
			trips: [],
			isLoading: true,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel />);

		expect(screen.getByText("Đang tải danh sách chuyến đi của bạn...")).toBeInTheDocument();
	});

	it("renders error state with retry button", () => {
		const refetchMock = vi.fn();
		mockUseMyTrips.mockReturnValue({
			trips: [],
			isLoading: false,
			error: "Lỗi tải dữ liệu",
			refetch: refetchMock,
		});

		render(<HostMyTripsPanel />);

		expect(screen.getByText("Lỗi tải dữ liệu")).toBeInTheDocument();
		const retryBtn = screen.getByRole("button", { name: /thử lại/i });
		fireEvent.click(retryBtn);
		expect(refetchMock).toHaveBeenCalled();
	});

	it("renders empty state with create button", () => {
		const onCreateTrip = vi.fn();
		mockUseMyTrips.mockReturnValue({
			trips: [],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel onCreateTrip={onCreateTrip} />);

		expect(screen.getByText("Chưa có chuyến đi nào được tạo")).toBeInTheDocument();
		const createBtns = screen.getAllByRole("button", { name: /tạo chuyến đi/i });
		expect(createBtns.length).toBeGreaterThanOrEqual(1);
		fireEvent.click(createBtns[0]);
		expect(onCreateTrip).toHaveBeenCalled();
	});

	it("renders toolbar action buttons and triggers callbacks", () => {
		const onCreateTrip = vi.fn();
		const onCreateTrekkingRoute = vi.fn();
		const onViewTrekkingRoutes = vi.fn();

		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(
			<HostMyTripsPanel
				onCreateTrip={onCreateTrip}
				onCreateTrekkingRoute={onCreateTrekkingRoute}
				onViewTrekkingRoutes={onViewTrekkingRoutes}
			/>
		);

		const createTripBtn = screen.getByRole("button", { name: /^tạo chuyến đi$/i });
		fireEvent.click(createTripBtn);
		expect(onCreateTrip).toHaveBeenCalled();

		const createRouteBtn = screen.getByRole("button", { name: /tạo tuyến trekking/i });
		fireEvent.click(createRouteBtn);
		expect(onCreateTrekkingRoute).toHaveBeenCalled();

		const viewRoutesBtn = screen.getByRole("button", { name: /quản lý tuyến/i });
		fireEvent.click(viewRoutesBtn);
		expect(onViewTrekkingRoutes).toHaveBeenCalled();

		expect(screen.queryByRole("button", { name: /quản lý kho thiết bị/i })).not.toBeInTheDocument();
	});

	it("renders list of host trips and handles navigation to trip detail", () => {
		const onNavigateToTripDetail = vi.fn();
		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel onNavigateToTripDetail={onNavigateToTripDetail} />);

		expect(screen.getByText("Sơn Trà Trekking Discovery")).toBeInTheDocument();
		expect(screen.getAllByText("Đang mở bán").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("550.000 đ")).toBeInTheDocument();
		expect(screen.getByText("01/10/2026")).toBeInTheDocument();

		const detailBtn = screen.getByRole("button", { name: /^chi tiết$/i });
		fireEvent.click(detailBtn);
		expect(onNavigateToTripDetail).toHaveBeenCalledWith("trip-1");
	});

	it("shows the primary trip tracking statuses clearly", () => {
		mockUseMyTrips.mockReturnValue({
			trips: trackedStatusTrips,
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel />);

		expect(screen.getAllByText("Đang diễn ra").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Kết thúc").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Đang mở bán").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Từ chối").length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText("Bị từ chối")).not.toBeInTheDocument();
	});

	it("preserves completed, cancelled and review statuses after their scheduled dates", () => {
		vi.setSystemTime(new Date("2026-10-15T00:00:00.000Z"));
		mockUseMyTrips.mockReturnValue({
			trips: [
				{ ...sampleTrip1, status: "completed" },
				{ ...sampleTrip2, status: "cancelled" },
				{ ...sampleTrip3, status: "rejected" },
			],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});
		render(<HostMyTripsPanel />);
		expect(screen.getByRole("button", { name: /Đã huỷ\s*1/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Kết thúc\s*1/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Từ chối\s*1/ })).toBeInTheDocument();
		expect(screen.queryByText("Đã đóng đăng ký")).not.toBeInTheDocument();
	});

	it("opens trip detail when clicking the whole trip card", () => {
		const onNavigateToTripDetail = vi.fn();
		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel onNavigateToTripDetail={onNavigateToTripDetail} />);

		fireEvent.click(
			screen.getByRole("button", { name: "Xem chi tiết chuyến đi Sơn Trà Trekking Discovery" })
		);

		expect(onNavigateToTripDetail).toHaveBeenCalledWith("trip-1");
	});

	it("shows edit action for pre-publication trips only", () => {
		const onEditTripDraft = vi.fn();
		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1, sampleTrip2, sampleTrip3],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel onEditTripDraft={onEditTripDraft} />);

		const editButtons = screen.getAllByRole("button", { name: /sửa/i });
		expect(editButtons).toHaveLength(2);

		fireEvent.click(editButtons[0]);
		expect(onEditTripDraft).toHaveBeenCalledWith("trip-2");
		fireEvent.click(editButtons[1]);
		expect(onEditTripDraft).toHaveBeenCalledWith("trip-3");
	});

	it("filters trips by status and updates pagination", () => {
		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1, sampleTrip2],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel />);

		// Both trips visible initially under "Tất cả"
		expect(screen.getByText("Sơn Trà Trekking Discovery")).toBeInTheDocument();
		expect(screen.getByText("Bidoup Núi Bà Chinh Phục")).toBeInTheDocument();

		// Click "Bản nháp" tab
		const draftTab = screen.getByRole("button", { name: /bản nháp/i });
		fireEvent.click(draftTab);

		// Now only draft trip is visible
		expect(screen.queryByText("Sơn Trà Trekking Discovery")).not.toBeInTheDocument();
		expect(screen.getByText("Bidoup Núi Bà Chinh Phục")).toBeInTheDocument();

		// Click "Tất cả" tab
		const allTab = screen.getByRole("button", { name: /tất cả/i });
		fireEvent.click(allTab);

		expect(screen.getByText("Sơn Trà Trekking Discovery")).toBeInTheDocument();
		expect(screen.getByText("Bidoup Núi Bà Chinh Phục")).toBeInTheDocument();
	});

	it("renders pagination controls and info", () => {
		mockUseMyTrips.mockReturnValue({
			trips: [sampleTrip1],
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});

		render(<HostMyTripsPanel />);

		expect(screen.getByText(/Trang 1 \/ 1/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /trước/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /sau/i })).toBeDisabled();
	});
});

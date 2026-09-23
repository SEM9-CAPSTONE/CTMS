import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMyTrips } from "../../trips/hooks/useMyTrips";
import type { TripDetails } from "../../trips/types";
import { HostMyTripsPanel } from "./HostMyTripsPanel";

vi.mock("../../trips/hooks/useMyTrips", () => ({
	useMyTrips: vi.fn(),
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

describe("HostMyTripsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
		const createBtns = screen.getAllByRole("button", { name: /tạo trip/i });
		expect(createBtns.length).toBeGreaterThanOrEqual(1);
		fireEvent.click(createBtns[0]);
		expect(onCreateTrip).toHaveBeenCalled();
	});

	it("renders toolbar action buttons and triggers callbacks", () => {
		const onCreateTrip = vi.fn();
		const onCreateTrekkingRoute = vi.fn();
		const onViewTrekkingRoutes = vi.fn();
		const onViewEquipmentCatalog = vi.fn();

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
				onViewEquipmentCatalog={onViewEquipmentCatalog}
			/>
		);

		const createTripBtn = screen.getByRole("button", { name: /^tạo trip$/i });
		fireEvent.click(createTripBtn);
		expect(onCreateTrip).toHaveBeenCalled();

		const createRouteBtn = screen.getByRole("button", { name: /tạo tuyến trekking/i });
		fireEvent.click(createRouteBtn);
		expect(onCreateTrekkingRoute).toHaveBeenCalled();

		const viewRoutesBtn = screen.getByRole("button", { name: /quản lý tuyến/i });
		fireEvent.click(viewRoutesBtn);
		expect(onViewTrekkingRoutes).toHaveBeenCalled();

		const viewCatalogBtn = screen.getByRole("button", { name: /quản lý kho thiết bị/i });
		fireEvent.click(viewCatalogBtn);
		expect(onViewEquipmentCatalog).toHaveBeenCalled();
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

		const detailBtn = screen.getByRole("button", { name: /chi tiết/i });
		fireEvent.click(detailBtn);
		expect(onNavigateToTripDetail).toHaveBeenCalledWith("trip-1");
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

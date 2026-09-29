import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

vi.mock("../features/trekking-routes/pages/CreateTrekkingRoutePage", () => ({
	CreateTrekkingRoutePage: () => <div>Create Trekking Route Page</div>,
}));
vi.mock("../features/trekking-routes/pages/TrekkingRoutesPage", () => ({
	TrekkingRoutesPage: () => <div>Trekking Routes Page</div>,
}));
vi.mock("../features/trips/pages/SearchTripsPage", () => ({
	SearchTripsPage: ({
		onBackHome,
		onNavigateToTripDetail,
	}: {
		onBackHome?: () => void;
		onNavigateToTripDetail: (tripId: string) => void;
	}) => (
		<div>
			<h1>Khám phá chuyến đi</h1>
			<button type="button" onClick={() => onNavigateToTripDetail("trip-123")}>
				Chi tiết
			</button>
			{onBackHome && (
				<button type="button" onClick={onBackHome}>
					Trang chủ
				</button>
			)}
		</div>
	),
}));

vi.mock("../features/trips/pages/TripDetailPage", () => ({
	TripDetailPage: ({
		tripId,
		onBackToList,
		onBackHome,
		bookingAccess,
		onViewBookingDetails,
	}: {
		tripId: string;
		onBackToList: () => void;
		onBackHome?: () => void;
		bookingAccess?: string;
		onViewBookingDetails: (bookingId: string) => void;
	}) => {
		const [flowIsActive] = useState(true);
		return (
			<div>
				<h1>Chi tiết chuyến đi</h1>
				<p>Mã chuyến: {tripId}</p>
				<p>Quyền đặt chỗ: {bookingAccess}</p>
				{flowIsActive && <p>Existing booking flow</p>}
				<button type="button" onClick={onBackToList}>
					Quay lại danh sách chuyến đi
				</button>
				<button type="button" onClick={() => onViewBookingDetails("booking-from-trip")}>
					Open booking from trip
				</button>
				{onBackHome && (
					<button type="button" onClick={onBackHome}>
						Trang chủ
					</button>
				)}
			</div>
		);
	},
}));

vi.mock("../features/booking-details/pages/BookingDetailsPage", () => ({
	BookingDetailsPage: ({
		bookingId,
		onBack,
		backLabel,
	}: {
		bookingId: string;
		onBack: () => void;
		backLabel?: string;
	}) => (
		<>
			<h1>Booking detail {bookingId}</h1>
			<button type="button" onClick={onBack}>
				{backLabel}
			</button>
		</>
	),
}));

vi.mock("../features/booking-list/pages/BookingListPage", () => ({
	BookingListPage: ({ onViewDetails }: { onViewDetails: (bookingId: string) => void }) => (
		<>
			<h1>Booking list</h1>
			<button type="button" onClick={() => onViewDetails("booking-456")}>
				Open booking
			</button>
		</>
	),
}));

describe("AppRoutes trip discovery and detail routing", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/trips");
	});

	it("renders SearchTripsPage when path is /trips", () => {
		render(<AppRoutes />);

		expect(screen.getByText("Khám phá chuyến đi")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Chi tiết" })).toBeInTheDocument();
	});

	it("navigates to TripDetailPage when a trip is selected and back", async () => {
		render(<AppRoutes />);

		expect(screen.getByText("Khám phá chuyến đi")).toBeInTheDocument();

		const detailBtn = screen.getByRole("button", { name: "Chi tiết" });
		await userEvent.click(detailBtn);

		expect(window.location.pathname).toBe("/trips/trip-123");
		expect(screen.getByText("Chi tiết chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("Mã chuyến: trip-123")).toBeInTheDocument();

		const backBtn = screen.getByRole("button", { name: "Quay lại danh sách chuyến đi" });
		await userEvent.click(backBtn);

		expect(window.location.pathname).toBe("/trips");
		expect(screen.getByText("Khám phá chuyến đi")).toBeInTheDocument();
	});

	it("renders TripDetailPage directly when path has /trips/:id", () => {
		window.history.replaceState({}, "", "/trips/trip-123");
		render(<AppRoutes />);

		expect(screen.getByText("Chi tiết chuyến đi")).toBeInTheDocument();
		expect(screen.getByText("Mã chuyến: trip-123")).toBeInTheDocument();
		expect(screen.getByText("Quyền đặt chỗ: anonymous")).toBeInTheDocument();
	});

	it("passes Camper booking access for a signed-in Camper", () => {
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: "camper-1",
				email: "camper@example.com",
				phone: null,
				role: "camper",
				roles: ["camper"],
				status: "active",
				createdAt: "2026-01-01T00:00:00.000Z",
			})
		);
		window.history.replaceState({}, "", "/trips/trip-123");
		render(<AppRoutes />);

		expect(screen.getByText("Quyền đặt chỗ: camper")).toBeInTheDocument();
	});
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

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
	}: {
		tripId: string;
		onBackToList: () => void;
		onBackHome?: () => void;
	}) => (
		<div>
			<h1>Chi tiết chuyến đi</h1>
			<p>Mã chuyến: {tripId}</p>
			<button type="button" onClick={onBackToList}>
				Quay lại danh sách chuyến đi
			</button>
			{onBackHome && (
				<button type="button" onClick={onBackHome}>
					Trang chủ
				</button>
			)}
		</div>
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
	});
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

async function renderLazy(...args: Parameters<typeof render>) {
	const result = render(...args);
	await waitForPage();
	return result;
}

async function waitForPage() {
	await waitFor(() => {
		expect(document.querySelector('[aria-busy="true"]')).toBeNull();
	});
}

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
vi.mock("../features/trips/pages/TripDetailPage", () => ({
	TripDetailPage: ({
		tripId,
		onBackToList,
		bookingAccess,
		onViewBookingDetails,
	}: {
		tripId: string;
		onBackToList: () => void;
		bookingAccess?: string;
		onViewBookingDetails: (bookingId: string) => void;
	}) => {
		const [flowIsActive] = useState(true);
		return (
			<>
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
			</>
		);
	},
}));
vi.mock("../features/trips/pages/SearchTripsPage", () => ({
	SearchTripsPage: ({
		onNavigateToTripDetail,
	}: {
		onNavigateToTripDetail: (tripId: string) => void;
	}) => (
		<>
			<h1>Khám phá chuyến đi</h1>
			<button type="button" onClick={() => onNavigateToTripDetail("trip-123")}>
				Chi tiết
			</button>
		</>
	),
}));
vi.mock("../features/trekking-routes/pages/CreateTrekkingRoutePage", () => ({
	CreateTrekkingRoutePage: () => <div>Create Trekking Route Page</div>,
}));
vi.mock("../features/trekking-routes/pages/TrekkingRoutesPage", () => ({
	TrekkingRoutesPage: () => <div>Trekking Routes Page</div>,
}));
function setUser(role: "camper" | "host") {
	localStorage.setItem(
		"authUser",
		JSON.stringify({
			id: `${role}-1`,
			email: `${role}@example.com`,
			phone: null,
			role,
			roles: [role],
			status: "active",
			createdAt: "2026-01-01T00:00:00.000Z",
		})
	);
}

describe("AppRoutes Booking details", () => {
	beforeEach(() => {
		localStorage.clear();
		window.history.replaceState({}, "", "/bookings/booking-123");
	});

	it("renders a direct Booking detail route for a Camper", async () => {
		setUser("camper");
		await renderLazy(<AppRoutes />);
		expect(screen.getByRole("heading", { name: "Booking detail booking-123" })).toBeVisible();
	});

	it("renders the owner list and navigates to details", async () => {
		setUser("camper");
		window.history.replaceState({}, "", "/bookings");
		await renderLazy(<AppRoutes />);
		expect(screen.getByRole("heading", { name: "Booking list" })).toBeVisible();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Open booking" }));
		});
		await waitForPage();
		expect(`${window.location.pathname}${window.location.search}`).toBe(
			"/bookings/booking-456?from=bookings"
		);
		expect(screen.getByRole("heading", { name: "Booking detail booking-456" })).toBeVisible();
	});

	it("returns from details to the owner list without browser history", async () => {
		setUser("camper");
		await renderLazy(<AppRoutes />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Quay lại đơn đặt chỗ" }));
		});
		await waitForPage();
		expect(window.location.pathname).toBe("/bookings");
		expect(screen.getByRole("heading", { name: "Booking list" })).toBeVisible();
	});

	it("returns to the same Trip Detail and preserves the mounted booking flow", async () => {
		setUser("camper");
		const tripId = "33333333-3333-4333-8333-333333333333";
		window.history.replaceState({}, "", `/trips/${tripId}`);
		await renderLazy(<AppRoutes />);

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Open booking from trip" }));
		});
		await waitForPage();
		expect(`${window.location.pathname}${window.location.search}`).toBe(
			`/bookings/booking-from-trip?from=trip&tripId=${tripId}`
		);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Quay lại chi tiết chuyến đi" }));
		});
		await waitForPage();

		expect(window.location.pathname).toBe(`/trips/${tripId}`);
		expect(screen.getByText("Existing booking flow")).toBeVisible();
	});

	it("preserves a Trip return destination after a direct refresh", async () => {
		setUser("camper");
		const tripId = "33333333-3333-4333-8333-333333333333";
		window.history.replaceState({}, "", `/bookings/booking-from-trip?from=trip&tripId=${tripId}`);
		await renderLazy(<AppRoutes />);

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Quay lại chi tiết chuyến đi" }));
		});
		await waitForPage();
		expect(window.location.pathname).toBe(`/trips/${tripId}`);
	});

	it("falls back to the Booking list for invalid Trip context", async () => {
		setUser("camper");
		window.history.replaceState({}, "", "/bookings/booking-123?from=trip&tripId=not-a-uuid");
		await renderLazy(<AppRoutes />);

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Quay lại đơn đặt chỗ" }));
		});
		await waitForPage();
		expect(window.location.pathname).toBe("/bookings");
	});

	it("guards an anonymous visitor", async () => {
		await renderLazy(<AppRoutes />);
		expect(screen.queryByText("Booking detail booking-123")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
		expect(screen.getByText("camper")).toBeVisible();
	});

	it("guards an anonymous visitor even when a valid Trip context is supplied", async () => {
		const tripId = "33333333-3333-4333-8333-333333333333";
		window.history.replaceState({}, "", `/bookings/booking-123?from=trip&tripId=${tripId}`);
		await renderLazy(<AppRoutes />);
		expect(screen.queryByText("Booking detail booking-123")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
	});

	it("guards a signed-in non-Camper", async () => {
		setUser("host");
		await renderLazy(<AppRoutes />);
		expect(screen.queryByText("Booking detail booking-123")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
		expect(screen.getByText("camper")).toBeVisible();
	});

	it.each([undefined, "host"] as const)("guards the owner list for %s", async (role) => {
		if (role) setUser(role);
		window.history.replaceState({}, "", "/bookings");
		await renderLazy(<AppRoutes />);
		expect(screen.queryByText("Booking list")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
	});
});

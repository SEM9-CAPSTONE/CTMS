import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("../features/trips/services/trips.service", () => ({
	tripsService: {
		getMyTrips: vi.fn().mockResolvedValue([]),
		getHostPorterAssignments: vi.fn().mockResolvedValue([]),
		getAssignedTrips: vi.fn().mockResolvedValue([]),
	},
}));
vi.mock("../features/camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: vi.fn().mockResolvedValue(null) },
}));

async function renderRoutes() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return await renderLazy(
		<QueryClientProvider client={client}>
			<AppRoutes />
		</QueryClientProvider>
	);
}

vi.mock("../features/auth/services/auth.service", () => ({
	authService: {
		validateSession: vi.fn().mockResolvedValue(undefined),
		logout: vi.fn().mockResolvedValue(undefined),
	},
}));
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
	}) => (
		<div>
			<h1>Chi tiết chuyến đi</h1>
			<p>Mã chuyến: {tripId}</p>
			<p>Quyền đặt chỗ: {bookingAccess}</p>
			<p>Existing booking flow</p>
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
	),
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

describe("AppRoutes trekking route navigation", () => {
	beforeEach(() => {
		localStorage.clear();
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: "host-id",
				email: "host@example.com",
				phone: null,
				role: "host",
				roles: ["host"],
				status: "active",
				createdAt: "2026-08-25T00:00:00.000Z",
			})
		);
		window.history.replaceState({}, "", "/dashboard");
	});

	it("navigates to create route", async () => {
		await renderRoutes();
		expect(screen.getByRole("button", { name: "Quản lý tuyến" })).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Tạo tuyến trekking" }));
		await waitForPage();

		expect(window.location.pathname).toBe("/host/trekking-routes/create");
		expect(window.location.search).toBe("");
		expect(screen.getByText("Create Trekking Route Page")).toBeInTheDocument();
		expect(screen.getAllByRole("complementary")).toHaveLength(1);
		expect(screen.getAllByRole("navigation", { name: "Dashboard navigation" })).toHaveLength(1);
	});

	it("navigates to the route list", async () => {
		await renderRoutes();
		expect(screen.getByRole("button", { name: "Tạo tuyến trekking" })).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Quản lý tuyến" }));
		await waitForPage();

		expect(window.location.pathname).toBe("/host/trekking-routes");
		expect(window.location.search).toBe("");
		expect(screen.getByText("Trekking Routes Page")).toBeInTheDocument();
		expect(screen.getAllByRole("complementary")).toHaveLength(1);
	});

	it.each(["camper", "porter", "admin"])(
		"does not expose Host Route actions on the %s dashboard",
		async (role) => {
			localStorage.setItem(
				"authUser",
				JSON.stringify({
					id: `${role}-id`,
					email: `${role}@example.com`,
					phone: null,
					role,
					roles: [role],
					status: "active",
					createdAt: "2026-08-25T00:00:00.000Z",
				})
			);

			await renderRoutes();

			expect(screen.queryByRole("button", { name: "Tạo tuyến trekking" })).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Quản lý tuyến trekking" })
			).not.toBeInTheDocument();
		}
	);

	it("keeps the existing Admin user-management action intact", async () => {
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: "admin-id",
				email: "admin@example.com",
				phone: null,
				role: "admin",
				roles: ["admin"],
				status: "active",
				createdAt: "2026-08-25T00:00:00.000Z",
			})
		);

		await renderRoutes();
		await userEvent.click(screen.getByRole("button", { name: "Quản lý user" }));
		await waitForPage();

		expect(window.location.pathname).toBe("/admin/users");
	});

	it.each(["camper", "porter"])("prevents %s from mounting the Host Route page", async (role) => {
		localStorage.setItem(
			"authUser",
			JSON.stringify({
				id: `${role}-id`,
				email: `${role}@example.com`,
				phone: null,
				role,
				roles: [role],
				status: "active",
				createdAt: "2026-08-25T00:00:00.000Z",
			})
		);
		window.history.replaceState({}, "", "/host/trekking-routes");

		await renderRoutes();

		expect(screen.queryByText("Trekking Routes Page")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Truy cập bị từ chối");
	});
});

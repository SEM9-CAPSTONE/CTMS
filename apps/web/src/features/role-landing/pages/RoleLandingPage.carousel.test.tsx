import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { tripsService } from "../../trips/services/trips.service";
import type { TripDetails } from "../../trips/types";
import { RoleLandingPage } from "./RoleLandingPage";
const state = vi.hoisted(() => ({ current: null as TripDetails | null }));
vi.mock("../hooks/useCamperMapTrip", () => ({
	useCamperMapTrip: () => ({ data: state.current, isLoading: false, refetch: vi.fn() }),
}));
vi.mock("../../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: async () => null },
}));
vi.mock("../components/CamperOperationalMap", () => ({
	CamperOperationalMap: ({ trip, navigation }: { trip: TripDetails; navigation?: ReactNode }) => (
		<div>
			{navigation}
			<h2 data-testid="shown-trip">{trip.title}</h2>
		</div>
	),
}));
const trip = (id: string): TripDetails => ({
	id,
	title: `Chuyến ${id}`,
	hostId: "host",
	host: null,
	description: null,
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2099-01-01",
	endsAt: "2099-01-02",
	meetingPoint: { type: "Point", coordinates: [108, 16] },
	meetingAt: null,
	bookingDeadline: "2098-12-30",
	capacityMin: 1,
	capacityMax: 10,
	seatsTaken: 1,
	remainingSeats: 9,
	pricePerPerson: 100,
	cancellationPolicy: null,
	status: "published",
	cancellationReason: null,
	cancelledAt: null,
	isBookable: true,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	waypoints: [],
});
const user: StoredAuthUser = {
	id: "camper",
	role: "camper",
	roles: ["camper"],
	email: "camper@test.local",
	phone: null,
	status: "active",
	createdAt: "2026-01-01",
};
beforeEach(() => {
	localStorage.setItem("accessToken", "test");
	state.current = trip("booked");
});
afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
	window.history.replaceState({}, "", "/");
});
function setup(totalPages = 1) {
	vi.spyOn(tripsService, "search").mockResolvedValue({
		items: [trip("other")].map((t) => ({ ...t, difficulty: null, weatherRiskLevel: null })),
		pagination: { page: 1, limit: 6, total: 1, totalPages },
	});
	vi.spyOn(tripsService, "getById").mockImplementation(async (id) => trip(id));
	const navigate = vi.fn();
	render(
		<RoleLandingPage
			user={user}
			roles={["camper"]}
			onBackHome={vi.fn()}
			onNavigateToTripDetail={navigate}
			onNavigateToTrips={vi.fn()}
		/>
	);
	return navigate;
}
it("pages the existing trip panel and sends the lower Quick Tasks button to exactly the displayed trip", async () => {
	const navigate = setup();
	await screen.findByText("Chuyến booked");
	expect(
		screen.queryByRole("heading", { name: "Khám phá thêm chuyến đi" })
	).not.toBeInTheDocument();
	await waitFor(() => expect(screen.getByRole("button", { name: "Chuyến tiếp" })).toBeEnabled());
	fireEvent.click(screen.getByRole("button", { name: "Khám phá chuyến đi" }));
	expect(navigate).toHaveBeenLastCalledWith("booked");
	fireEvent.click(screen.getByRole("button", { name: "Chuyến tiếp" }));
	await screen.findByText("Chuyến other");
	fireEvent.click(screen.getByRole("button", { name: "Khám phá chuyến đi" }));
	expect(navigate).toHaveBeenLastCalledWith("other");
	fireEvent.click(screen.getByRole("button", { name: "Chuyến trước" }));
	await screen.findByText("Chuyến booked");
	fireEvent.click(screen.getByRole("button", { name: "Khám phá chuyến đi" }));
	expect(navigate).toHaveBeenLastCalledWith("booked");
});
it("shows public trips without a booking", async () => {
	state.current = null;
	setup();
	await screen.findByText("Chuyến other");
	expect(screen.getByRole("button", { name: "Chuyến trước" })).toBeDisabled();
	expect(screen.getByRole("button", { name: "Chuyến tiếp" })).toBeDisabled();
});
it("disables the lower explore action while a different trip is loading, then binds it to the new trip", async () => {
	const navigate = setup();
	await screen.findByText("Chuyến booked");
	let resolve: (trip: TripDetails) => void = () => {};
	vi.mocked(tripsService.getById).mockReturnValue(
		new Promise<TripDetails>((done) => {
			resolve = done;
		})
	);
	await waitFor(() => expect(screen.getByRole("button", { name: "Chuyến tiếp" })).toBeEnabled());
	fireEvent.click(screen.getByRole("button", { name: "Chuyến tiếp" }));
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Khám phá chuyến đi" })).toBeDisabled()
	);
	resolve(trip("other"));
	await screen.findByText("Chuyến other");
	fireEvent.click(screen.getByRole("button", { name: "Khám phá chuyến đi" }));
	expect(navigate).toHaveBeenCalledExactlyOnceWith("other");
});

it("fetches the next API page at the end and keeps the lower action bound to its selected trip", async () => {
	state.current = null;
	const navigate = setup(2);
	vi.mocked(tripsService.search).mockImplementation(async (query) => ({
		items: [
			{ ...trip(query?.page === 2 ? "third" : "other"), difficulty: null, weatherRiskLevel: null },
		],
		pagination: { page: query?.page ?? 1, limit: 6, total: 2, totalPages: 2 },
	}));
	await screen.findByText("Chuyến other");
	await waitFor(() => expect(screen.getByRole("button", { name: "Chuyến tiếp" })).toBeEnabled());
	fireEvent.click(screen.getByRole("button", { name: "Chuyến tiếp" }));
	await screen.findByText("Chuyến third");
	expect(tripsService.search).toHaveBeenLastCalledWith({ page: 2, limit: 6 });
	fireEvent.click(screen.getByRole("button", { name: "Khám phá chuyến đi" }));
	expect(navigate).toHaveBeenCalledExactlyOnceWith("third");
});

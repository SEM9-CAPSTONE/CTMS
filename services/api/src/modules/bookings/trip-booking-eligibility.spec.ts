import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../trips/entities/trip.entity";
import { type TripBookingFacts, evaluateTripBookingEligibility } from "./trip-booking-eligibility";

const now = new Date("2026-11-14T03:00:00.000Z");
const open = (overrides: Partial<TripBookingFacts> = {}): TripBookingFacts => ({
	status: TripStatus.PUBLISHED,
	routeStatus: TrekkingRouteStatus.ACTIVE,
	bookingDeadline: new Date("2026-11-20T00:00:00.000Z"),
	startsAt: new Date("2026-11-21T00:00:00.000Z"),
	capacityMax: 10,
	seatsTaken: 4,
	weatherPausedAt: null,
	...overrides,
});

describe("evaluateTripBookingEligibility", () => {
	it("accepts an open Trip with seats", () => {
		expect(evaluateTripBookingEligibility(open(), 1, now)).toBeNull();
		expect(evaluateTripBookingEligibility(open({ capacityMax: null }), 50, now)).toBeNull();
	});

	it.each([
		["not_published", { status: TripStatus.DRAFT }],
		["not_published", { status: TripStatus.CANCELLED }],
		["weather_paused", { weatherPausedAt: new Date("2026-11-13T00:00:00.000Z") }],
		["booking_closed", { bookingDeadline: now }],
		["booking_closed", { bookingDeadline: new Date(now.getTime() - 1) }],
		["already_started", { startsAt: now }],
		["route_inactive", { routeStatus: TrekkingRouteStatus.CLOSED }],
		["route_inactive", { routeStatus: null }],
		["insufficient_seats", { seatsTaken: 10 }],
	] as const)("rejects %s", (expected, overrides) => {
		expect(evaluateTripBookingEligibility(open(overrides), 1, now)).toBe(expected);
	});

	it("treats the deadline as open until the exact instant", () => {
		expect(
			evaluateTripBookingEligibility(open({ bookingDeadline: new Date(now.getTime() + 1) }), 1, now)
		).toBeNull();
	});

	it("checks the party size against remaining seats", () => {
		expect(evaluateTripBookingEligibility(open({ seatsTaken: 8 }), 2, now)).toBeNull();
		expect(evaluateTripBookingEligibility(open({ seatsTaken: 8 }), 3, now)).toBe(
			"insufficient_seats"
		);
		expect(evaluateTripBookingEligibility(open(), 0, now)).toBe("invalid_party_size");
	});
});

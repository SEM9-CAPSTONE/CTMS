import { describe, expect, it } from "vitest";
import type { HostPorterAssignmentTrip, TripDetails } from "../../trips/types";
import { buildHostOperationalOverview } from "./host-operational-overview";

function trip(overrides: Partial<TripDetails> = {}): TripDetails {
	return {
		id: "today",
		hostId: "host",
		title: "Real trip",
		description: null,
		coverImageUrl: null,
		itinerary: null,
		includes: null,
		excludes: null,
		tripType: "day_trip",
		durationNights: 0,
		startsAt: "2026-10-15T01:00:00+07:00",
		endsAt: "2026-10-15T08:00:00+07:00",
		meetingPoint: { type: "Point", coordinates: [108, 16] },
		meetingAt: null,
		bookingDeadline: "2026-10-14T00:00:00+07:00",
		capacityMin: 1,
		capacityMax: 10,
		seatsTaken: 3,
		remainingSeats: 7,
		pricePerPerson: 100000,
		cancellationPolicy: null,
		status: "ongoing",
		cancellationReason: null,
		cancelledAt: null,
		weatherRiskLevel: "red",
		isBookable: false,
		createdAt: "2026-10-01T00:00:00Z",
		updatedAt: "2026-10-01T00:00:00Z",
		waypoints: [],
		...overrides,
	};
}

const now = Date.parse("2026-10-15T02:00:00+07:00");

describe("buildHostOperationalOverview", () => {
	it("uses Vietnam's day boundary and includes overnight trips but excludes cancelled/draft trips", () => {
		const result = buildHostOperationalOverview(
			[
				trip(),
				trip({ id: "overnight", startsAt: "2026-10-14T20:00:00+07:00", seatsTaken: 2 }),
				trip({
					id: "yesterday",
					status: "completed",
					endsAt: "2026-10-15T00:00:00+07:00",
					startsAt: "2026-10-14T08:00:00+07:00",
				}),
				trip({ id: "cancelled", status: "cancelled", seatsTaken: 99 }),
				trip({ id: "draft", status: "draft", seatsTaken: 99 }),
			],
			[],
			now
		);
		expect(result.todayTrips).toBe(2);
		expect(result.ongoingTrips).toBe(2);
		expect(result.seatsToday).toBe(5);
		expect(result.weatherWarnings).toBe(2);
		expect(result.operationalTrips.map((item) => item.id)).toEqual(["overnight", "today"]);
	});

	it("counts assigned porters once across today's trips and excludes inactive assignments", () => {
		const assignment = (porterId: string, status: "assigned" | "unassigned") => ({
			porterId,
			status,
			displayName: null,
			email: null,
			assignedAt: null,
			reconfirmationDeadline: null,
			reconfirmedAt: null,
			declinedAt: null,
		});
		const assignments: HostPorterAssignmentTrip[] = [
			{
				...trip(),
				assignedPorterCount: 1,
				assignments: [assignment("p1", "assigned"), assignment("p2", "unassigned")],
			},
			{
				...trip({ id: "second" }),
				assignedPorterCount: 1,
				assignments: [assignment("p1", "assigned")],
			},
			{
				...trip({ id: "other" }),
				assignedPorterCount: 1,
				assignments: [assignment("p3", "assigned")],
			},
		];
		const result = buildHostOperationalOverview([trip(), trip({ id: "second" })], assignments, now);
		expect(result.assignedPortersToday).toBe(1);
	});

	it("prioritizes known weather risks and reports unknown weather without inventing alerts", () => {
		const result = buildHostOperationalOverview(
			[
				trip({ id: "unknown", weatherRiskLevel: null }),
				trip({ id: "yellow", weatherRiskLevel: "yellow" }),
				trip({
					id: "red",
					status: "published",
					startsAt: "2026-10-16T01:00:00+07:00",
					endsAt: "2026-10-16T08:00:00+07:00",
				}),
			],
			[],
			now
		);
		expect(result.focusTrip?.id).toBe("red");
		expect(result.focusHeading).toBe("Chuyến đi cần theo dõi");
		expect(result.unknownWeather).toBe(1);
		expect(result.weatherWarnings).toBe(2);
	});

	it("shows low-risk ongoing and upcoming trips without implying a warning", () => {
		const ongoing = buildHostOperationalOverview([trip({ weatherRiskLevel: "green" })], [], now);
		expect(ongoing.focusHeading).toBe("Chuyến đi đang diễn ra");
		expect(ongoing.weatherWarnings).toBe(0);
		const upcoming = buildHostOperationalOverview(
			[
				trip({
					weatherRiskLevel: "green",
					status: "published",
					startsAt: "2026-10-16T01:00:00+07:00",
					endsAt: "2026-10-16T08:00:00+07:00",
				}),
			],
			[],
			now
		);
		expect(upcoming.focusHeading).toBe("Chuyến đi sắp khởi hành");
	});

	it("returns an empty overview instead of sample content", () => {
		const result = buildHostOperationalOverview([], [], now);
		expect(result.todayTrips).toBe(0);
		expect(result.focusTrip).toBeUndefined();
		expect(result.operationalTrips).toEqual([]);
	});

	it("keeps every simultaneous trip selectable", () => {
		const trips = Array.from({ length: 7 }, (_, index) => trip({ id: `trip-${index}` }));
		const result = buildHostOperationalOverview(trips, [], now);
		expect(result.operationalTrips).toHaveLength(7);
		expect(result.ongoingTrips).toBe(7);
	});
});

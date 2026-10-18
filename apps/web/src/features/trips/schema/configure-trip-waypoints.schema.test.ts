import { describe, expect, it } from "vitest";
import type { Trip, TripWaypointType } from "../types";
import {
	type ConfigureTripWaypointFormItem,
	createConfigureTripWaypointsSchema,
} from "./configure-trip-waypoints.schema";

const OVERNIGHT_REQUIRED_MESSAGE = "Chuyến đi nhiều ngày cần ít nhất 1 chỗ ngủ qua đêm";
const DAY_TRIP_OVERNIGHT_MESSAGE = "Chuyến đi trong ngày không được có điểm dừng qua đêm";

function buildTrip(overrides: Partial<Trip>): Trip {
	return {
		id: "33333333-3333-4333-8333-333333333333",
		hostId: "11111111-1111-4111-8111-111111111111",
		routeId: "22222222-2222-4222-8222-222222222222",
		title: "Bidoup draft",
		description: null,
		coverImageUrl: null,
		itinerary: null,
		includes: null,
		excludes: null,
		tripType: "day_trip",
		durationNights: 0,
		startsAt: "2026-10-01T02:00:00.000Z",
		endsAt: "2026-10-01T10:00:00.000Z",
		meetingPoint: { type: "Point", coordinates: [108.22, 16.04] },
		meetingAt: null,
		bookingDeadline: "2026-09-30T02:00:00.000Z",
		capacityMin: 2,
		capacityMax: 12,
		seatsTaken: 0,
		pricePerPerson: 0,
		cancellationPolicy: null,
		status: "draft",
		createdAt: "2026-09-22T00:00:00.000Z",
		updatedAt: "2026-09-22T00:00:00.000Z",
		waypoints: [],
		...overrides,
	};
}

const multiDayTrip = buildTrip({
	tripType: "overnight",
	durationNights: 2,
	endsAt: "2026-10-03T10:00:00.000Z",
});

function waypoint(
	type: TripWaypointType,
	routeOrder: string,
	plannedAt: string
): ConfigureTripWaypointFormItem {
	return {
		id: "",
		checkpointId: "",
		type,
		name: type,
		longitude: "108.24",
		latitude: "16.05",
		routeOrder,
		plannedAt,
	};
}

function multiDayWaypoints(middle: ConfigureTripWaypointFormItem[]) {
	return [
		waypoint("start", "0", "2026-10-01T02:00:00.000Z"),
		...middle,
		waypoint("finish", "1", "2026-10-03T10:00:00.000Z"),
	];
}

function issueMessages(trip: Trip, waypoints: ConfigureTripWaypointFormItem[]): string[] {
	const result = createConfigureTripWaypointsSchema(trip).safeParse({ waypoints });
	return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("createConfigureTripWaypointsSchema overnight stops", () => {
	it("rejects a multi-day trip without any overnight stop", () => {
		const messages = issueMessages(
			multiDayTrip,
			multiDayWaypoints([waypoint("rest", "0.3", "2026-10-01T05:00:00.000Z")])
		);

		expect(messages).toContain(OVERNIGHT_REQUIRED_MESSAGE);
	});

	it("accepts a multi-day trip with a single overnight stop", () => {
		const messages = issueMessages(
			multiDayTrip,
			multiDayWaypoints([waypoint("overnight", "0.5", "2026-10-01T12:00:00.000Z")])
		);

		expect(messages).toEqual([]);
	});

	it("accepts several overnight stops alongside other rest stops", () => {
		const messages = issueMessages(
			multiDayTrip,
			multiDayWaypoints([
				waypoint("rest", "0.2", "2026-10-01T05:00:00.000Z"),
				waypoint("overnight", "0.4", "2026-10-01T12:00:00.000Z"),
				waypoint("rest", "0.5", "2026-10-02T03:00:00.000Z"),
				waypoint("overnight", "0.7", "2026-10-02T12:00:00.000Z"),
				waypoint("overnight", "0.9", "2026-10-03T03:00:00.000Z"),
			])
		);

		expect(messages).toEqual([]);
	});

	it("keeps day trips free of overnight stops", () => {
		const dayTrip = buildTrip({});
		const start = waypoint("start", "0", "2026-10-01T02:00:00.000Z");
		const finish = waypoint("finish", "1", "2026-10-01T10:00:00.000Z");

		expect(
			issueMessages(dayTrip, [start, waypoint("rest", "0.5", "2026-10-01T05:00:00.000Z"), finish])
		).toEqual([]);
		expect(
			issueMessages(dayTrip, [
				start,
				waypoint("overnight", "0.5", "2026-10-01T05:00:00.000Z"),
				finish,
			])
		).toContain(DAY_TRIP_OVERNIGHT_MESSAGE);
	});
});

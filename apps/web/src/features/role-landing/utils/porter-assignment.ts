import type { PorterTripWaypoint, TripStatus } from "../../trips/types";

const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

export type PorterTripPhase = "upcoming" | "ongoing" | "finished";

export const PORTER_TRIP_PHASES: PorterTripPhase[] = ["upcoming", "ongoing", "finished"];

export const porterTripPhaseLabels: Record<PorterTripPhase, string> = {
	upcoming: "Sắp diễn ra",
	ongoing: "Đang diễn ra",
	finished: "Đã kết thúc",
};

const phaseByStatus: Partial<Record<TripStatus, PorterTripPhase>> = {
	published: "upcoming",
	ongoing: "ongoing",
	completed: "finished",
};

/**
 * Porters only see the three operational phases; any other Trip status is not displayable.
 * The status is the one stored in the database, advanced over time by the backend.
 */
export function toPorterTripPhase(status: TripStatus): PorterTripPhase | null {
	return phaseByStatus[status] ?? null;
}

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
	timeZone: BUSINESS_TIME_ZONE,
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
	timeZone: BUSINESS_TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

export function formatTripDay(value: string | Date): string {
	return dayFormatter.format(new Date(value));
}

export function formatTripTime(value: string | Date): string {
	return timeFormatter.format(new Date(value));
}

/**
 * Same-day Trips show a single date; multi-day Trips show a date range. The hour range is always
 * the departure and finish time.
 */
export function formatTripSchedule(startsAt: string, endsAt: string) {
	const startDay = formatTripDay(startsAt);
	const endDay = formatTripDay(endsAt);
	const hours = `${formatTripTime(startsAt)} – ${formatTripTime(endsAt)}`;
	if (startDay === endDay) return { date: startDay, hours, isMultiDay: false };
	const sameYear = startDay.slice(6) === endDay.slice(6);
	return {
		date: `${sameYear ? startDay.slice(0, 5) : startDay} – ${endDay}`,
		hours,
		isMultiDay: true,
	};
}

export interface PorterScheduleDay {
	dayNumber: number;
	date: string | null;
	waypoints: PorterTripWaypoint[];
}

/** Groups waypoints by Trip day; a day's date comes from its own planned times when available. */
export function groupWaypointsByDay(
	waypoints: PorterTripWaypoint[],
	startsAt: string
): PorterScheduleDay[] {
	const days = new Map<number, PorterTripWaypoint[]>();
	for (const waypoint of [...waypoints].sort(
		(a, b) => a.dayNumber - b.dayNumber || a.sequenceOrder - b.sequenceOrder
	)) {
		days.set(waypoint.dayNumber, [...(days.get(waypoint.dayNumber) ?? []), waypoint]);
	}
	return [...days.entries()].map(([dayNumber, items]) => {
		const planned = items.find((item) => item.plannedAt)?.plannedAt;
		const fallback = new Date(startsAt);
		fallback.setUTCDate(fallback.getUTCDate() + dayNumber - 1);
		return {
			dayNumber,
			date: planned ? formatTripDay(planned) : formatTripDay(fallback),
			waypoints: items,
		};
	});
}

export function normalizeSearchText(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase()
		.trim();
}

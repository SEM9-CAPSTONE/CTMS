import type { HostPorterAssignmentTrip, TripDetails } from "../../trips/types";
import { getTripDisplayStatus } from "../../trips/utils/trip-status";

const vietnamDate = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Asia/Ho_Chi_Minh",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function getOperationalTripHeading(trip?: {
	weatherRiskLevel?: TripDetails["weatherRiskLevel"];
	displayStatus: TripDetails["status"];
}) {
	if (trip?.weatherRiskLevel === "yellow" || trip?.weatherRiskLevel === "red") {
		return "Chuyến đi cần theo dõi";
	}
	return trip?.displayStatus === "ongoing" ? "Chuyến đi đang diễn ra" : "Chuyến đi sắp khởi hành";
}

export function buildHostOperationalOverview(
	trips: TripDetails[],
	assignments: HostPorterAssignmentTrip[],
	now: number
) {
	const today = vietnamDate.format(now);
	const todayStart = Date.parse(`${today}T00:00:00+07:00`);
	const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
	const normalized = trips.map((trip) => ({
		...trip,
		displayStatus: getTripDisplayStatus(trip, now),
	}));
	const todayTrips = normalized.filter(
		(trip) =>
			["published", "ongoing", "completed"].includes(trip.displayStatus) &&
			Date.parse(trip.startsAt) < tomorrowStart &&
			Date.parse(trip.endsAt) > todayStart
	);
	const scheduled = normalized
		.filter((trip) => trip.displayStatus === "published" || trip.displayStatus === "ongoing")
		.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
	const todayIds = new Set(todayTrips.map((trip) => trip.id));
	const porterIds = new Set(
		assignments
			.filter((trip) => todayIds.has(trip.id))
			.flatMap((trip) => trip.assignments)
			.filter((assignment) => assignment.status === "assigned")
			.map((assignment) => assignment.porterId)
	);
	const riskRank = { red: 2, yellow: 1, green: 0 };
	const operationalTrips = [...scheduled].sort(
		(a, b) =>
			riskRank[b.weatherRiskLevel ?? "green"] - riskRank[a.weatherRiskLevel ?? "green"] ||
			Number(b.displayStatus === "ongoing") - Number(a.displayStatus === "ongoing") ||
			Date.parse(a.startsAt) - Date.parse(b.startsAt)
	);
	const focusTrip = operationalTrips[0];
	return {
		focusHeading: getOperationalTripHeading(focusTrip),
		operationalTrips,
		todayTrips: todayTrips.length,
		ongoingTrips: normalized.filter((trip) => trip.displayStatus === "ongoing").length,
		seatsToday: todayTrips.reduce((sum, trip) => sum + trip.seatsTaken, 0),
		weatherWarnings: scheduled.filter(
			(trip) => trip.weatherRiskLevel === "red" || trip.weatherRiskLevel === "yellow"
		).length,
		unknownWeather: scheduled.filter((trip) => !trip.weatherRiskLevel).length,
		assignedPortersToday: porterIds.size,
		focusTrip,
	};
}

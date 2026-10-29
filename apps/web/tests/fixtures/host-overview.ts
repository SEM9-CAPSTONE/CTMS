import type { HostOverview, OverviewSection } from "../../src/features/host-overview/types";

export function overviewFixture(): HostOverview {
	const now = new Date().toISOString();
	function section<T>(source: string, items: T[], total = items.length): OverviewSection<T> {
		return { source, queriedAt: now, availability: "available", data: { total, items } };
	}
	return {
		generatedAt: now,
		timeZone: "Asia/Ho_Chi_Minh",
		bookingDate: "2026-10-28",
		page: 1,
		limit: 5,
		kpis: { todaysBookings: 7, activeTrips: 1, routes: 1, assignedPorters: 1, unresolvedSos: 1 },
		bookings: section(
			"bookings",
			[
				{
					id: "booking-one",
					tripId: "trip-one",
					status: "confirmed",
					paymentStatus: "paid",
					numPeople: 2,
					createdAt: now,
				},
			],
			7
		),
		activeTrips: section("trips", [
			{
				id: "trip-one",
				title: "Chuyến Núi Chúa",
				routeId: "route-one",
				status: "ongoing",
				startsAt: now,
				endsAt: now,
				updatedAt: now,
			},
		]),
		routes: section("trekking_routes", [
			{ id: "route-one", name: "Tuyến Núi Chúa", status: "active", updatedAt: now },
		]),
		porters: section("trip_porters", [
			{
				id: "porter-one",
				porterId: "porter-one",
				assignments: [{ tripId: "trip-one", status: "pending_reconfirmation" }],
			},
		]),
		sos: section("sos_alerts", [
			{
				id: "sos-one",
				tripId: "trip-one",
				status: "active",
				emergencyType: "injury",
				eventTime: now,
				receivedAt: now,
				updatedAt: now,
			},
		]),
		weather: section("weather_risk_assessments", [
			{
				id: "route-one",
				routeId: "route-one",
				assessmentId: "assessment-one",
				riskLevel: "red",
				criteriaScores: null,
				assessedAt: now,
				observedAt: now,
				fetchedAt: now,
				state: "available",
			},
		]),
	};
}

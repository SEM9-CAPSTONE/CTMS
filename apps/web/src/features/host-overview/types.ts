export type Availability = "available" | "unavailable";
export type WeatherState = Availability | "stale";
export type RiskLevel = "green" | "yellow" | "red";
export interface OverviewSection<T> {
	availability: Availability;
	queriedAt: string;
	source: string;
	data: { total: number; items: T[] } | null;
}
export interface OverviewBooking {
	id: string;
	tripId: string;
	status:
		| "pending_payment"
		| "confirmed"
		| "pending_reconfirmation"
		| "cancelled"
		| "expired"
		| "completed"
		| null;
	paymentStatus: "not_required" | "unpaid" | "paid" | null;
	numPeople: number | null;
	createdAt: string;
}
export interface OverviewTrip {
	id: string;
	title: string;
	routeId: string;
	status:
		| "draft"
		| "pending_approval"
		| "published"
		| "ongoing"
		| "completed"
		| "cancelled"
		| "rejected";
	startsAt: string;
	endsAt: string;
	updatedAt: string;
}
export interface OverviewRoute {
	id: string;
	name: string;
	status: "draft" | "pending_approval" | "active" | "closed";
	updatedAt: string;
}
export interface OverviewPorter {
	id: string;
	porterId: string;
	assignments: { tripId: string; status: "assigned" | "pending_reconfirmation" | "unassigned" }[];
}
export interface OverviewSos {
	id: string;
	tripId: string;
	status: "active" | "acknowledged" | "cancelled" | "closed";
	emergencyType: "medical" | "injury" | "lost" | "natural_hazard" | "other";
	eventTime: string;
	receivedAt: string;
	updatedAt: string;
}
export interface CriterionScore {
	value: number | boolean;
	level: RiskLevel;
	weight: number;
	score: number;
}
export interface OverviewWeather {
	id: string;
	routeId: string;
	assessmentId: string | null;
	riskLevel: RiskLevel | null;
	criteriaScores: Record<
		"rainfall" | "wind" | "temperature" | "visibility" | "thunderstorm",
		CriterionScore
	> | null;
	assessedAt: string | null;
	observedAt: string | null;
	fetchedAt: string | null;
	state: WeatherState;
}
export interface HostOverview {
	generatedAt: string;
	timeZone: string;
	bookingDate: string;
	page: number;
	limit: number;
	kpis: {
		todaysBookings: number | null;
		activeTrips: number | null;
		routes: number | null;
		assignedPorters: number | null;
		unresolvedSos: number | null;
	};
	bookings: OverviewSection<OverviewBooking>;
	activeTrips: OverviewSection<OverviewTrip>;
	routes: OverviewSection<OverviewRoute>;
	porters: OverviewSection<OverviewPorter>;
	sos: OverviewSection<OverviewSos>;
	weather: OverviewSection<OverviewWeather>;
}

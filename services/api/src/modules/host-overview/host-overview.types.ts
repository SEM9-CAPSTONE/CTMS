import type { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { EmergencyType, SosStatus } from "../sos/sos.enums";
import type { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import type { TripStatus } from "../trips/entities/trip.entity";
import type {
	RiskLevel,
	WeatherCriteriaScoresDetail,
} from "../weather/entities/weather-risk-assessment.entity";

export enum OverviewAvailability {
	AVAILABLE = "available",
	UNAVAILABLE = "unavailable",
}
export enum OverviewWeatherState {
	AVAILABLE = "available",
	STALE = "stale",
	UNAVAILABLE = "unavailable",
}
export interface OverviewPage<T> {
	total: number;
	items: T[];
}
export interface OverviewSection<T> {
	availability: OverviewAvailability;
	queriedAt: string;
	source: string;
	data: OverviewPage<T> | null;
}
export interface OverviewBooking {
	id: string;
	tripId: string;
	status: BookingStatus | null;
	paymentStatus: BookingPaymentStatus | null;
	numPeople: number | null;
	createdAt: string;
}
export interface OverviewTrip {
	id: string;
	title: string;
	routeId: string;
	status: TripStatus;
	startsAt: string;
	endsAt: string;
	updatedAt: string;
}
export interface OverviewRoute {
	id: string;
	name: string;
	status: TrekkingRouteStatus;
	updatedAt: string;
}
export interface OverviewPorter {
	id: string;
	porterId: string;
	assignments: { tripId: string; status: TripPorterStatus }[];
}
export interface OverviewSos {
	id: string;
	tripId: string;
	status: SosStatus;
	emergencyType: EmergencyType;
	eventTime: string;
	receivedAt: string;
	updatedAt: string;
}
export interface OverviewWeather {
	id: string;
	routeId: string;
	assessmentId: string | null;
	riskLevel: RiskLevel | null;
	criteriaScores: WeatherCriteriaScoresDetail | null;
	assessedAt: string | null;
	observedAt: string | null;
	fetchedAt: string | null;
	state: OverviewWeatherState;
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

export type PorterAvailabilityStatus = "available" | "unavailable";

export const PORTER_AVAILABILITY_STATUSES: PorterAvailabilityStatus[] = [
	"available",
	"unavailable",
];

export type PorterRouteProficiency = "learning" | "proficient" | "expert";

export const PORTER_ROUTE_PROFICIENCIES: PorterRouteProficiency[] = [
	"learning",
	"proficient",
	"expert",
];

export interface PorterProfile {
	porterId: string;
	experienceYears: number;
	certifications: string[];
	languages: string[];
	availabilityStatus: PorterAvailabilityStatus;
	ratingAvg: number;
	completedTrips: number;
	version: number;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface PorterLedTripHistoryItem {
	tripId: string;
	tripTitle: string;
	routeId: string;
	routeName: string;
	startsAt: string;
	endsAt: string;
	role: "lead";
	status: "completed";
}

export interface PorterLedTripHistoryResponse {
	items: PorterLedTripHistoryItem[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface UpdatePorterProfileInput {
	experienceYears?: number;
	certifications?: string[];
	languages?: string[];
	availabilityStatus?: PorterAvailabilityStatus;
	expectedVersion?: number;
}

export interface PorterRouteQualification {
	qualificationId: string;
	porterId: string;
	routeId: string;
	proficiency: PorterRouteProficiency;
	timesLed: number;
	verifiedBy: string | null;
	verifiedAt: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
}

export interface UpsertPorterRouteQualificationInput {
	proficiency: PorterRouteProficiency;
	timesLed: number;
	expectedVersion?: number;
}

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

export interface RoutePorterQualification extends PorterRouteQualification {
	porterDisplayName: string | null;
}

export interface UpsertPorterRouteQualificationInput {
	proficiency: PorterRouteProficiency;
	timesLed: number;
	expectedVersion?: number;
}

export interface VerifyPorterRouteQualificationInput {
	expectedVersion: number;
}

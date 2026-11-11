export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "UNKNOWN";

export type AllergySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FitnessLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export type AccountStatus = "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DELETED";

export interface AllergyItem {
	id: string;
	name: string;
	severity: AllergySeverity;
	reaction?: string;
}

export interface MedicalConditionItem {
	id: string;
	name: string;
	medication?: string;
	notes?: string;
}

export interface HealthSharingConsent {
	isConsentGranted: boolean;
	grantedAt?: string;
	revokedAt?: string;
	allowedRoles: ("HOST" | "PORTER")[];
	activeTripScope?: string;
}

export interface HealthProfileData {
	id: string;
	camperId: string;
	camperName: string;
	bloodType: BloodType;
	physicalFitnessLevel: FitnessLevel;
	dietaryRestrictions: string;
	emergencyNotes: string;
	allergies: AllergyItem[];
	medicalConditions: MedicalConditionItem[];
	consent: HealthSharingConsent;
	accountStatus: AccountStatus;
	updatedAt: string;
	version: number;
}

export interface HealthProfileResponse {
	data: HealthProfileData;
	message?: string;
}

export interface ApiErrorResponse {
	statusCode: number;
	error: string;
	message: string;
}

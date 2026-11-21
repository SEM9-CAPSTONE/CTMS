import type { PorterRouteProficiency } from "../porter-profile/types";

export type PorterLevel = PorterRouteProficiency;
export interface LevelDefinition {
	name: string;
	minExperienceYears: number | null;
	minTimesLed: number | null;
	minCompletedTrips?: number | null;
	minTotalKm?: number | null;
	minAverageRating?: number | null;
	requiredSkills: string[];
	requiredCertifications: string[];
	responsibilities: string;
}
export interface LevelPolicy {
	level: PorterLevel;
	definition: LevelDefinition;
	version: number;
	updatedBy: string;
	updatedAt: string;
}
export interface LevelEvidence {
	skills: string[];
	version: number;
}
export interface LevelQualification {
	id: string;
	porterId: string;
	routeId: string;
	routeName: string;
	porterName: string | null;
	proficiency: PorterLevel;
	timesLed: number;
	verifiedBy: string | null;
	version: number;
}
export interface LevelDossier {
	porterId: string;
	porterName: string | null;
	profileVersion: number;
	experienceYears: number;
	certifications: string[];
	skills: string[];
	evidenceVersion: number;
	verificationStatus: string | null;
	verificationUpdatedAt: string | null;
	timesLed: number;
}
export interface LevelGapItem {
	code:
		| "missing_trips"
		| "missing_km"
		| "missing_experience"
		| "low_rating"
		| "missing_cert"
		| "expired_cert"
		| "pending_cert"
		| "rejected_cert"
		| "missing_skill";
	label: string;
	detail: string;
	actionType: "upload_cert" | "complete_trips" | "improve_rating" | "update_skills";
}

export interface CertificateEvaluationItem {
	reqCode: string;
	name: string;
	status: "verified" | "expired" | "pending" | "rejected" | "missing";
	expiryDate?: string | null;
	rejectionReason?: string | null;
	met: boolean;
}

export interface LevelComparison {
	experience: boolean | null;
	timesLed: boolean | null;
	completedTrips?: boolean | null;
	totalKm?: boolean | null;
	averageRating?: boolean | null;
	missingSkills: string[];
	missingCertifications: string[];
	expiredCertifications?: string[];
	certificateDetails?: CertificateEvaluationItem[];
	missingItems?: LevelGapItem[];
	allMet?: boolean;
}

export interface GlobalPorterLevelAlert {
	type: "missing_criteria" | "cert_expiring" | "cert_expired" | "eligible_upgrade";
	severity: "info" | "warning" | "success";
	title: string;
	message: string;
}

export interface GlobalPorterLevelEvaluation {
	level: PorterLevel;
	policy: LevelPolicy | null;
	comparison: LevelComparison | null;
	progressPercent: number;
}

export interface GlobalPorterLevelOverview {
	porterId: string;
	porterName: string | null;
	porterEmail?: string | null;
	currentLevel: PorterLevel;
	levelVerifiedAt: string | null;
	metrics: {
		completedTrips: number;
		totalKmLed: number;
		averageRating: number;
		reviewCount: number;
		experienceYears: number;
		verifiedCertificatesCount: number;
		distinctRoutesCount: number;
	};
	certificates: Array<{
		id?: string;
		type: string;
		name: string;
		status: string;
		expiryDate: string;
		rejectionReason?: string | null;
	}>;
	skills: string[];
	nextLevel: PorterLevel | null;
	nextLevelEvaluation: GlobalPorterLevelEvaluation | null;
	levels: GlobalPorterLevelEvaluation[];
	alerts: GlobalPorterLevelAlert[];
}

export interface GlobalPorterSummaryItem {
	porterId: string;
	porterName: string;
	porterEmail: string;
	currentLevel: PorterLevel;
	levelVerifiedAt: string | null;
	completedTrips: number;
	totalKmLed: number;
	averageRating: number;
	reviewCount: number;
	experienceYears: number;
	verifiedCertificatesCount: number;
	nextLevel: PorterLevel | null;
	nextLevelAllMet: boolean;
	nextLevelProgressPercent: number;
	missingItems: LevelGapItem[];
}

export interface DecideGlobalLevelInput {
	targetLevel: PorterLevel;
	outcome: "approved" | "rejected";
	reason: string;
}
export interface ReviewContext {
	openRequestId?: string | null;
	qualification: LevelQualification;
	dossier: LevelDossier;
	dossierHash: string;
	policy: LevelPolicy | null;
	comparison: LevelComparison | null;
}
export interface LevelDecision {
	actorName?: string | null;
	routeName?: string;
	id: string;
	qualificationId: string;
	porterId: string;
	routeId: string;
	actorId: string;
	outcome: "approved" | "rejected";
	fromLevel: PorterLevel | null;
	toLevel: PorterLevel;
	reason: string;
	policySnapshot: LevelPolicy;
	dossierSnapshot: LevelDossier;
	comparisonSnapshot: LevelComparison | null;
	source?: "direct" | "request";
	requestId?: string | null;
	action?: string | null;
	fromVerified?: boolean | null;
	toVerified?: boolean | null;
	evidenceSnapshot?: Array<{ id: string; requestId: string; fileName: string; checksum: string }>;
	porterReason?: string | null;
	decidedAt: string;
}
export interface DecideLevelInput {
	level: PorterLevel;
	outcome: "approved" | "rejected";
	reason: string;
	expectedQualificationVersion: number;
	expectedPolicyVersion: number;
	expectedDossierHash: string;
}

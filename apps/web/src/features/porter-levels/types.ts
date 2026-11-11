import type { PorterRouteProficiency } from "../porter-profile/types";

export type PorterLevel = PorterRouteProficiency;
export interface LevelDefinition {
	name: string;
	minExperienceYears: number | null;
	minTimesLed: number | null;
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
export interface LevelComparison {
	experience: boolean | null;
	timesLed: boolean | null;
	missingSkills: string[];
	missingCertifications: string[];
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

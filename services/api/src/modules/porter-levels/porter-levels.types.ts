import type { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";

export interface LevelDefinition {
	name: string;
	minExperienceYears: number | null;
	minTimesLed: number | null;
	requiredSkills: string[];
	requiredCertifications: string[];
	responsibilities: string;
}

export interface LevelPolicy {
	level: PorterRouteProficiency;
	definition: LevelDefinition;
	version: number;
	updatedBy: string;
	updatedAt: Date;
}

export interface LevelEvidence {
	skills: string[];
	version: number;
}

export interface DossierCertificate {
	id?: string;
	type: string;
	name: string;
	status: string; // 'verified' | 'pending' | 'rejected'
	expiryDate: string | Date;
	rejectionReason?: string | null;
}

export interface LevelDossier {
	porterId: string;
	porterName: string | null;
	profileVersion: number;
	experienceYears: number;
	certifications: string[];
	certificates?: DossierCertificate[];
	skills: string[];
	evidenceVersion: number;
	verificationStatus: string | null;
	verificationUpdatedAt: Date | null;
	timesLed: number;
}

export interface LevelQualification {
	id: string;
	porterId: string;
	routeId: string;
	routeName: string;
	porterName: string | null;
	proficiency: PorterRouteProficiency;
	timesLed: number;
	verifiedBy: string | null;
	version: number;
}

export interface CertificateEvaluationItem {
	reqCode: string;
	name: string;
	status: "verified" | "expired" | "pending" | "rejected" | "missing";
	expiryDate?: string | Date | null;
	rejectionReason?: string | null;
	met: boolean;
}

export interface LevelComparison {
	experience: boolean | null;
	timesLed: boolean | null;
	missingSkills: string[];
	missingCertifications: string[];
	expiredCertifications: string[];
	rejectedCertifications: Array<{ type: string; name: string; rejectionReason?: string | null }>;
	pendingCertifications: Array<{ type: string; name: string }>;
	certificateDetails: CertificateEvaluationItem[];
	allMet: boolean;
}

export enum LevelDecisionOutcome {
	APPROVED = "approved",
	REJECTED = "rejected",
}

export interface LevelDecision {
	actorName?: string | null;
	routeName?: string;
	id: string;
	qualificationId: string;
	porterId: string;
	routeId: string;
	actorId: string;
	outcome: LevelDecisionOutcome;
	fromLevel: PorterRouteProficiency | null;
	toLevel: PorterRouteProficiency;
	reason: string;
	policySnapshot: LevelPolicy;
	dossierSnapshot: LevelDossier;
	comparisonSnapshot: LevelComparison | null;
	source: "request" | "direct";
	requestId: string | null;
	action: "upgrade" | "downgrade" | "recognize" | "reject" | null;
	fromVerified: boolean | null;
	toVerified: boolean | null;
	evidenceSnapshot: unknown[];
	porterReason: string | null;
	decidedAt: Date;
}

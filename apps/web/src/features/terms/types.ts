export type TermsPlatform = "web" | "mobile" | "api";
export type TermsAcceptanceSource = "registration" | "reconsent";

export interface TermsSubsection {
	code: string;
	title: string;
	body: string;
}

export interface TermsSection {
	number: number;
	slug: string;
	title: string;
	subsections: TermsSubsection[];
	callout?: string;
}

export interface TermsVersionSummary {
	id: string;
	version: string;
	title: string;
	summary: string | null;
	effectiveDate: string;
	isActive: boolean;
	requiresReconsent: boolean;
	publishedAt: string;
}

export interface TermsVersionDetail extends TermsVersionSummary {
	sections: TermsSection[];
}

export interface TermsAcceptanceRecord {
	id: string;
	version: string;
	acceptedAt: string;
	source: TermsAcceptanceSource;
	platform: TermsPlatform;
}

export interface MyTermsStatus {
	currentVersion: string;
	currentTitle: string;
	currentEffectiveDate: string;
	currentSummary: string | null;
	requiresReconsent: boolean;
	acceptedCurrentVersion: boolean;
	needsReconsent: boolean;
	latestAcceptance: TermsAcceptanceRecord | null;
	acceptanceHistory: TermsAcceptanceRecord[];
}

export interface AcceptTermsPayload {
	version: string;
	platform?: TermsPlatform;
}

export interface AcceptTermsResponse {
	accepted: boolean;
	version: string;
	effectiveDate: string;
	acceptedAt: string;
	alreadyAccepted: boolean;
}

export interface CreateTermsVersionPayload {
	version: string;
	title: string;
	summary?: string | null;
	effectiveDate: string;
	sections: TermsSection[];
	requiresReconsent: boolean;
}

export interface UpdateTermsVersionPayload {
	title?: string;
	summary?: string | null;
	effectiveDate?: string;
	sections?: TermsSection[];
	requiresReconsent?: boolean;
}

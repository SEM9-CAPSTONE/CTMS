/** Weather penalty of a Host who did not answer a Red forecast (CTMS-94 API, policy §6). */
export type WeatherPenaltyStatus = "applied" | "waived";
export type WeatherPenaltyWaiverDecision = "approved" | "rejected";
export type AdminPenaltyFilter = "waiver_pending" | "applied" | "waived" | "all";

export interface WeatherPenaltyWaiver {
	reason: string | null;
	evidenceUrls: string[];
	requestedAt: string | null;
	reviewDueAt: string | null;
	decision: WeatherPenaltyWaiverDecision | null;
	reviewedAt: string | null;
	reviewNote: string | null;
}

export interface WeatherPenalty {
	id: string;
	tripId: string;
	tripTitle: string;
	tripStartsAt: string;
	hostId: string;
	hostName: string | null;
	violationNumber: number;
	bookingValue: string;
	ratePercent: number;
	capAmount: string;
	amount: string;
	deductedAmount: string;
	outstandingAmount: string;
	status: WeatherPenaltyStatus;
	hostingBlockedUntil: string | null;
	waiverDeadline: string;
	waiver: WeatherPenaltyWaiver;
	createdAt: string;
}

export interface MyWeatherPenalties {
	items: WeatherPenalty[];
	outstandingTotal: string;
	hostingBlockedUntil: string | null;
	suspended: boolean;
}

export interface WaiverRequestInput {
	reason: string;
	evidenceUrls: string[];
}

export interface WaiverReviewInput {
	approve: boolean;
	note: string;
}

export interface UploadedEvidence {
	url: string;
	key?: string;
}

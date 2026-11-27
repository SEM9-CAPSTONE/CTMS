import type { PlatformPaymentAccount } from "../platform-bank-account/types";

/** Weather penalty of a Host who did not answer a Red forecast (CTMS-94 API, policy §6). */
export type WeatherPenaltyStatus = "applied" | "waived";
export type WeatherPenaltyWaiverDecision = "approved" | "rejected";
export type AdminPenaltyFilter = "waiver_pending" | "unpaid" | "applied" | "waived" | "all";

export interface WeatherPenaltyWaiver {
	reason: string | null;
	evidenceUrls: string[];
	requestedAt: string | null;
	reviewDueAt: string | null;
	decision: WeatherPenaltyWaiverDecision | null;
	reviewedAt: string | null;
	reviewNote: string | null;
}

/** What the settlements did not cover is paid by bank transfer within 7 days. */
export interface WeatherPenaltyPayment {
	dueAt: string;
	/** Money still owed after `dueAt`: the Host cannot create or submit Trips. */
	overdue: boolean;
	collectedAmount: string;
	collectedAt: string | null;
	reference: string | null;
	note: string | null;
}

export interface WeatherPenalty {
	id: string;
	tripId: string;
	tripTitle: string;
	tripStartsAt: string;
	hostId: string;
	hostName: string | null;
	violationNumber: number;
	/** Penalty base: the Host's earnings (paid bookings minus the platform commission). */
	bookingValue: string;
	ratePercent: number;
	capAmount: string;
	amount: string;
	deductedAmount: string;
	outstandingAmount: string;
	payment: WeatherPenaltyPayment;
	status: WeatherPenaltyStatus;
	hostingBlockedUntil: string | null;
	waiverDeadline: string;
	waiver: WeatherPenaltyWaiver;
	createdAt: string;
}

export interface MyWeatherPenalties {
	items: WeatherPenalty[];
	outstandingTotal: string;
	/** Owed past the 7-day deadline. */
	overdueTotal: string;
	hostingBlockedUntil: string | null;
	suspended: boolean;
	/** Where to transfer what settlements did not cover; null until an Admin sets it. */
	paymentAccount: PlatformPaymentAccount | null;
}

export interface WaiverRequestInput {
	reason: string;
	evidenceUrls: string[];
}

export interface PaymentConfirmationInput {
	reference: string;
	note?: string;
}

export interface WaiverReviewInput {
	approve: boolean;
	note: string;
}

export interface UploadedEvidence {
	url: string;
	key?: string;
}

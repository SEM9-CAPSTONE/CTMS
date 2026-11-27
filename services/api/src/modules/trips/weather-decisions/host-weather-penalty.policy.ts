import { splitPlatformCommission } from "../../bookings/platform-commission";

/**
 * Penalty for a Host who did not answer a Red forecast before T-24h,
 * docs/features/weather-trip-date-decision-policy.md §6. Pure rules, unit-tested without a database.
 * The numbers are the policy's proposal (§8 item 3/4); change them here only.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Violations are counted over the last 90 days; waived penalties do not count. */
export const PENALTY_COUNT_WINDOW_MS = 90 * DAY_MS;
/** The Host may ask for a waiver within 72 h after the T-24h deadline. */
export const PENALTY_WAIVER_REQUEST_MS = 72 * HOUR_MS;
/** The Admin reviews a waiver within 5 working days (shown only, nothing happens automatically). */
export const PENALTY_WAIVER_REVIEW_WORKING_DAYS = 5;
/**
 * A penalty the settlements could not cover (e.g. the Host's first Trip was cancelled, so there is
 * no revenue) is paid by the Host within 7 days; after that the Host cannot create or submit Trips
 * until an Admin confirms the payment.
 */
export const PENALTY_PAYMENT_DAYS = 7;
/** T-24h, same deadline as trip-weather-decision.policy.ts. */
const HOST_DEADLINE_MS = 24 * HOUR_MS;

export interface PenaltyTier {
	/** Rate in basis points (1/100 of a percent) so the maths stays in integers. */
	rateBasisPoints: number;
	/** Cap in VND. */
	capVnd: number;
	/** Days the Host cannot create or submit Trips; `null` = no block, `"suspended"` = tier 3. */
	hostingBlock: number | "suspended" | null;
}

export const PENALTY_TIERS: readonly PenaltyTier[] = [
	{ rateBasisPoints: 500, capVnd: 2_000_000, hostingBlock: null },
	{ rateBasisPoints: 1000, capVnd: 5_000_000, hostingBlock: 14 },
	{ rateBasisPoints: 1500, capVnd: 10_000_000, hostingBlock: "suspended" },
];

/** Violation 1, 2, 3 and later (3+ share the last tier). */
export function penaltyTier(violationNumber: number): PenaltyTier {
	const index = Math.min(Math.max(violationNumber, 1), PENALTY_TIERS.length) - 1;
	return PENALTY_TIERS[index];
}

/**
 * Penalty base in minor units: what the Host earns from the Trip, i.e. the paid bookings minus the
 * platform commission, rounded exactly like the settlement.
 */
export function penaltyBaseMinor(paidBookingsMinor: bigint): bigint {
	return splitPlatformCommission(paidBookingsMinor).netMinor;
}

/** Amount in minor units (đồng × 100): rate of the penalty base (Host earnings), capped. */
export function penaltyAmountMinor(baseMinor: bigint, tier: PenaltyTier): bigint {
	const raw = (baseMinor * BigInt(tier.rateBasisPoints)) / 10_000n;
	const cap = BigInt(tier.capVnd) * 100n;
	return raw < cap ? raw : cap;
}

/** Until when the Host cannot create Trips because of this penalty; `null` when no dated block. */
export function hostingBlockedUntil(tier: PenaltyTier, now: Date): Date | null {
	return typeof tier.hostingBlock === "number"
		? new Date(now.getTime() + tier.hostingBlock * DAY_MS)
		: null;
}

/** Last moment for the Host to pay what the settlements did not cover. */
export function paymentDueAt(createdAt: Date): Date {
	return new Date(createdAt.getTime() + PENALTY_PAYMENT_DAYS * DAY_MS);
}

export interface AppliedPenaltyForRestriction {
	createdAt: Date;
	hostingBlockedUntil: Date | null;
	/** Amount still unpaid (not deducted and not collected), in minor units. */
	outstandingMinor: bigint;
	paymentDueAt: Date;
}

export interface HostingRestriction {
	/** The Host cannot create or submit Trips before this time; `null` = no dated restriction. */
	blockedUntil: Date | null;
	/** Tier 3: 3+ applied violations in 90 days (PD-2, lifted when the count drops below 3). */
	suspended: boolean;
	/** Unpaid amount past its 7-day payment deadline, in minor units; blocks until paid. */
	overdueDebtMinor: bigint;
}

/**
 * Restriction from the Host's applied penalties: the latest dated block (tier 2), the tier-3
 * suspension, which lasts while 3 or more applied penalties fall in the last 90 days, and any
 * unpaid amount past its payment deadline (no end date: it lasts until the debt is paid).
 */
export function hostingRestriction(
	applied: AppliedPenaltyForRestriction[],
	now: Date
): HostingRestriction {
	let blockedUntil: Date | null = null;
	for (const penalty of applied) {
		const until = penalty.hostingBlockedUntil;
		if (until && until > now && (!blockedUntil || until > blockedUntil)) blockedUntil = until;
	}
	const recent = applied
		.map((penalty) => penalty.createdAt)
		.filter((createdAt) => createdAt.getTime() > now.getTime() - PENALTY_COUNT_WINDOW_MS)
		.sort((a, b) => b.getTime() - a.getTime());
	const suspensionTier = PENALTY_TIERS.length;
	const suspended = recent.length >= suspensionTier;
	if (suspended) {
		const liftsAt = new Date(recent[suspensionTier - 1].getTime() + PENALTY_COUNT_WINDOW_MS);
		if (!blockedUntil || liftsAt > blockedUntil) blockedUntil = liftsAt;
	}
	const overdueDebtMinor = applied
		.filter((penalty) => penalty.outstandingMinor > 0n && penalty.paymentDueAt < now)
		.reduce((sum, penalty) => sum + penalty.outstandingMinor, 0n);
	return { blockedUntil, suspended, overdueDebtMinor };
}

/** A penalty is due when an Admin acts at or after T-24h and the Host gave no on-time answer. */
export function isPenaltyDue(input: {
	startsAt: Date;
	now: Date;
	/** True when the schedule already had an Admin decision (only the first one penalises). */
	adminAlreadyDecided: boolean;
	/** True when the Host recorded a decision before T-24h. */
	hostAnsweredOnTime: boolean;
}): boolean {
	if (input.adminAlreadyDecided || input.hostAnsweredOnTime) return false;
	return input.startsAt.getTime() - input.now.getTime() <= HOST_DEADLINE_MS;
}

/** 72 h after the T-24h deadline, i.e. 48 h after the planned start. */
export function waiverRequestDeadline(tripStartsAt: Date): Date {
	return new Date(tripStartsAt.getTime() - HOST_DEADLINE_MS + PENALTY_WAIVER_REQUEST_MS);
}

/** Adds working days (Monday–Friday, Asia/Ho_Chi_Minh calendar days). */
export function addWorkingDays(from: Date, days: number): Date {
	const VN_OFFSET_MS = 7 * HOUR_MS;
	let cursor = from.getTime();
	let added = 0;
	while (added < days) {
		cursor += DAY_MS;
		const weekday = new Date(cursor + VN_OFFSET_MS).getUTCDay();
		if (weekday !== 0 && weekday !== 6) added += 1;
	}
	return new Date(cursor);
}

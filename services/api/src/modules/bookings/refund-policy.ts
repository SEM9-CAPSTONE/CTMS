import { ConflictException } from "@nestjs/common";
import { type Booking, BookingStatus } from "../profiles/entities/booking.entity";
import { type Trip, TripStatus } from "../trips/entities/trip.entity";
import { minorToMoney, moneyToMinor } from "./cancellation-policy";
import { type Payment, PaymentStatus, PaymentType } from "./entities/payment.entity";

export enum RefundOrigin {
	CAMPER_CANCELLATION = "camper_cancellation",
	CAMPER_COMPLAINT = "camper_complaint",
	HOST_TRIP_CANCELLATION = "host_trip_cancellation",
	SYSTEM_TRIP_CANCELLATION = "system_trip_cancellation",
	LATE_PAYMENT_AFTER_EXPIRY = "late_payment_after_expiry",
}

export interface RefundEligibilityValidationParams {
	booking: Booking;
	trip: Trip;
	origin: RefundOrigin;
	requestTime: Date;
}

export interface RefundEligibilityResult {
	eligible: boolean;
	policySource: string;
	reason: string;
}

export interface SettlementBlockerResult {
	isBlocked: boolean;
	blockingReasons: string[];
	blockingPaymentIds: string[];
	totalCharges: string;
	totalSucceededRefunds: string;
	heldFunds: string;
	settlementBase: string;
}

/**
 * Validates refund eligibility against the approved pre-Trip and post-completion
 * request windows and the authoritative Booking/participation state (BR-103).
 *
 * Rules:
 *  - Camper-initiated refund:
 *    (a) Pre-Trip cancellation: Booking was cancelled before trips.starts_at.
 *    (b) Post-completion complaint: completed participation submitted <= 24 hours after trips.completed_at.
 *    Requests outside these two windows must be rejected.
 *  - Host/System Trip cancellation:
 *    Refund obligations caused by Host/System Trip cancellation are NOT limited by Camper request windows.
 */
export function validateRefundEligibility(
	params: RefundEligibilityValidationParams
): RefundEligibilityResult {
	const { booking, trip, origin, requestTime } = params;

	switch (origin) {
		case RefundOrigin.CAMPER_CANCELLATION: {
			if (booking.status !== BookingStatus.CANCELLED) {
				throw new ConflictException("Camper cancellation refund requires cancelled booking status");
			}
			const tripStartsAt = booking.tripStartsAtSnapshot ?? trip.startsAt;
			if (!tripStartsAt || !Number.isFinite(tripStartsAt.getTime())) {
				throw new ConflictException("Booking is missing a valid Trip start timestamp");
			}
			const cancellationTime = booking.cancelledAt ?? requestTime;
			if (cancellationTime.getTime() >= tripStartsAt.getTime()) {
				throw new ConflictException(
					"Camper cancellation refund request is outside the pre-Trip cancellation window"
				);
			}
			return {
				eligible: true,
				policySource: "booking_cancellation_policy",
				reason: "camper_pre_trip_cancellation",
			};
		}

		case RefundOrigin.CAMPER_COMPLAINT: {
			if (booking.status !== BookingStatus.COMPLETED) {
				throw new ConflictException("Complaint refund request requires completed participation");
			}
			const completedAt = (trip as unknown as { completedAt?: Date }).completedAt ?? trip.endsAt;
			if (!completedAt || !Number.isFinite(completedAt.getTime())) {
				throw new ConflictException("Trip is missing a valid completion timestamp");
			}
			if (trip.status !== TripStatus.COMPLETED && requestTime.getTime() < completedAt.getTime()) {
				throw new ConflictException(
					"Camper complaint refund request requires completed Trip status"
				);
			}
			const maxComplaintDeadlineMs = completedAt.getTime() + 24 * 60 * 60 * 1000;
			if (requestTime.getTime() > maxComplaintDeadlineMs) {
				throw new ConflictException(
					"Camper complaint refund request is outside the 24-hour post-completion window"
				);
			}
			return {
				eligible: true,
				policySource: "camper_complaint_resolution",
				reason: "camper_post_completion_complaint",
			};
		}

		case RefundOrigin.HOST_TRIP_CANCELLATION: {
			if (trip.status !== TripStatus.CANCELLED) {
				throw new ConflictException("Host Trip cancellation refund requires cancelled Trip status");
			}
			return {
				eligible: true,
				policySource: "host_trip_cancellation_policy",
				reason: "host_trip_cancellation",
			};
		}

		case RefundOrigin.SYSTEM_TRIP_CANCELLATION: {
			if (trip.status !== TripStatus.CANCELLED) {
				throw new ConflictException(
					"System Trip cancellation refund requires cancelled Trip status"
				);
			}
			return {
				eligible: true,
				policySource: "system_trip_cancellation_policy",
				reason: "system_trip_cancellation",
			};
		}

		case RefundOrigin.LATE_PAYMENT_AFTER_EXPIRY: {
			if (booking.status !== BookingStatus.EXPIRED) {
				throw new ConflictException(
					"Late payment after expiry refund requires expired booking status"
				);
			}
			return {
				eligible: true,
				policySource: "late_payment_expiry_policy",
				reason: "late_payment_after_expiry",
			};
		}

		default:
			throw new ConflictException("Unsupported refund origin");
	}
}

/**
 * Validates that an eligible pre-Trip refund is submitted to the payment provider
 * within the required 24-hour processing window from refund_requested_at (BR-104).
 */
export function validatePreTripProcessingWindow(
	refundRequestedAt: Date,
	processingTime: Date
): void {
	const windowMs = 24 * 60 * 60 * 1000;
	if (processingTime.getTime() - refundRequestedAt.getTime() > windowMs) {
		throw new ConflictException(
			"Pre-Trip refund submission exceeds the required 24-hour processing window"
		);
	}
}

/**
 * Calculates remaining refundable amount against the original succeeded charge.
 * Ensures cumulative pending + succeeded refunds do not exceed the charge amount (PB AC-4, BR-105).
 * Failed refunds do not count against the cap (PB AC-7).
 */
export function calculateRemainingRefundableAmount(
	chargeAmount: string,
	existingRefunds: ReadonlyArray<{
		amount: string;
		status: PaymentStatus;
		id?: string;
		type?: PaymentType;
	}>,
	currentRefundId?: string
): { committedMinor: bigint; remainingMinor: bigint; remainingAmount: string } {
	const chargeMinor = moneyToMinor(chargeAmount);
	const activeRefunds = existingRefunds.filter(
		(r) =>
			(r.type === undefined || r.type === PaymentType.REFUND) &&
			(r.status === PaymentStatus.PENDING || r.status === PaymentStatus.SUCCEEDED) &&
			(!currentRefundId || r.id !== currentRefundId)
	);
	const committedMinor = activeRefunds.reduce((sum, r) => sum + moneyToMinor(r.amount), 0n);
	if (committedMinor > chargeMinor) {
		throw new ConflictException("Committed refunds already exceed the eligible charge amount");
	}
	const remainingMinor = chargeMinor - committedMinor;
	return {
		committedMinor,
		remainingMinor,
		remainingAmount: minorToMoney(remainingMinor),
	};
}

/**
 * Evaluates whether settlement/payout is blocked and computes the authoritative
 * Held Funds and settlement base (BR-106, BR-336, BR-343).
 *
 * Rules:
 *  - Pending refund obligations ("approved-refund-pending" / pending provider execution) block settlement.
 *  - Succeeded refunds reduce Held Funds and the settlement base.
 *  - Pending or failed refunds are NOT treated as succeeded and do not reduce Held Funds.
 */
export function evaluateSettlementBlockers(
	payments: Payment[],
	externalClaims?: ReadonlyArray<{ id: string; status: string }>
): SettlementBlockerResult {
	const blockingPaymentIds: string[] = [];
	const blockingReasons: string[] = [];

	let totalChargesMinor = 0n;
	let totalSucceededRefundsMinor = 0n;

	for (const payment of payments) {
		if (payment.type === PaymentType.CHARGE && payment.status === PaymentStatus.SUCCEEDED) {
			totalChargesMinor += moneyToMinor(payment.amount);
		} else if (payment.type === PaymentType.REFUND) {
			if (payment.status === PaymentStatus.SUCCEEDED) {
				totalSucceededRefundsMinor += moneyToMinor(payment.amount);
			} else if (payment.status === PaymentStatus.PENDING) {
				blockingPaymentIds.push(payment.id);
				blockingReasons.push(
					`Refund payment ${payment.id} is pending provider execution/settlement`
				);
			}
		}
	}

	if (externalClaims) {
		for (const claim of externalClaims) {
			if (["pending", "reviewing", "approved-refund-pending"].includes(claim.status)) {
				blockingReasons.push(`Claim ${claim.id} is in blocking state '${claim.status}'`);
			}
		}
	}

	const hasBlockingClaims =
		externalClaims?.some((c) =>
			["pending", "reviewing", "approved-refund-pending"].includes(c.status)
		) ?? false;

	const isBlocked = blockingPaymentIds.length > 0 || hasBlockingClaims;

	const heldFundsMinor =
		totalChargesMinor >= totalSucceededRefundsMinor
			? totalChargesMinor - totalSucceededRefundsMinor
			: 0n;

	return {
		isBlocked,
		blockingReasons,
		blockingPaymentIds,
		totalCharges: minorToMoney(totalChargesMinor),
		totalSucceededRefunds: minorToMoney(totalSucceededRefundsMinor),
		heldFunds: minorToMoney(heldFundsMinor),
		settlementBase: minorToMoney(heldFundsMinor),
	};
}

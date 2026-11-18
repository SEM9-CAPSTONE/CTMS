import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import {
	PORTER_REVIEW_WINDOW_MS,
	PorterReviewIneligibleReason,
	type PorterReviewParticipation,
	type PorterReviewRecord,
} from "./porter-reviews.types";

export function porterReviewEligibility(participation: PorterReviewParticipation, now: Date) {
	const { completedAt, checkedInAt, leftAt } = participation;
	const expiresAt = completedAt ? new Date(completedAt.getTime() + PORTER_REVIEW_WINDOW_MS) : null;
	if (
		participation.bookingStatus !== BookingStatus.COMPLETED ||
		participation.memberStatus !== BookingMemberStatus.JOINED ||
		!completedAt ||
		!checkedInAt ||
		leftAt !== null ||
		checkedInAt > completedAt ||
		completedAt > now
	) {
		return {
			eligible: false,
			reason: PorterReviewIneligibleReason.PARTICIPATION_NOT_COMPLETED,
			expiresAt,
		};
	}
	if (expiresAt && now >= expiresAt) {
		return { eligible: false, reason: PorterReviewIneligibleReason.WINDOW_EXPIRED, expiresAt };
	}
	return { eligible: true, reason: null, expiresAt };
}

export function canEditPorterReview(
	participation: PorterReviewParticipation,
	review: PorterReviewRecord,
	now: Date
): boolean {
	// Assignment changes do not revoke an already valid review or extend its original deadline.
	return (
		porterReviewEligibility(participation, now).eligible &&
		review.memberId === participation.memberId &&
		review.reviewerId === participation.reviewerId &&
		review.createdAt >= (participation.completedAt ?? now) &&
		review.createdAt <= now &&
		now < review.editExpiresAt
	);
}

export function porterReviewCreationEligibility(
	participation: PorterReviewParticipation,
	now: Date,
	hasAssignment: boolean
) {
	const eligibility = porterReviewEligibility(participation, now);
	return {
		...eligibility,
		eligible: eligibility.eligible && hasAssignment,
		reason:
			eligibility.reason ??
			(hasAssignment ? null : PorterReviewIneligibleReason.NO_ELIGIBLE_ASSIGNMENT),
	};
}

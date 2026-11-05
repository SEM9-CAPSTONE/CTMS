import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { BookingStatus } from "../profiles/entities/booking.entity";
import {
	REVIEW_WINDOW_MS,
	ReviewIneligibleReason,
	type ReviewParticipation,
} from "./trip-reviews.types";

export function reviewEligibility(participation: ReviewParticipation, now: Date) {
	const { completedAt, checkedInAt, leftAt } = participation;
	const expiresAt = completedAt ? new Date(completedAt.getTime() + REVIEW_WINDOW_MS) : null;
	const completed =
		participation.bookingStatus === BookingStatus.COMPLETED &&
		participation.memberStatus === BookingMemberStatus.JOINED &&
		checkedInAt !== null &&
		leftAt === null &&
		completedAt !== null &&
		checkedInAt <= completedAt &&
		completedAt <= now;
	if (!completed) {
		return {
			eligible: false,
			reason: ReviewIneligibleReason.PARTICIPATION_NOT_COMPLETED,
			expiresAt,
		};
	}
	if (expiresAt && now >= expiresAt) {
		return { eligible: false, reason: ReviewIneligibleReason.WINDOW_EXPIRED, expiresAt };
	}
	return { eligible: true, reason: null, expiresAt };
}

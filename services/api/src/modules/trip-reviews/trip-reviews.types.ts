import type { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { BookingStatus } from "../profiles/entities/booking.entity";

export enum ReviewTarget {
	TRIP = "trip",
	HOST = "host",
}

export const REVIEW_WINDOW_MS = 72 * 60 * 60 * 1000;
export const REVIEW_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

export enum ReviewIneligibleReason {
	PARTICIPATION_NOT_COMPLETED = "PARTICIPATION_NOT_COMPLETED",
	WINDOW_EXPIRED = "WINDOW_EXPIRED",
}

export interface ReviewParticipation {
	bookingId: string;
	memberId: string;
	reviewerId: string;
	tripId: string;
	hostId: string;
	bookingStatus: BookingStatus | null;
	memberStatus: BookingMemberStatus;
	checkedInAt: Date | null;
	leftAt: Date | null;
	completedAt: Date | null;
}

export interface TripReviewRecord {
	images?: string[];
	canEdit?: boolean;
	editExpiresAt?: Date;
	id: string;
	bookingId: string;
	memberId: string;
	reviewerId: string;
	tripId: string;
	hostId: string;
	target: ReviewTarget;
	targetId: string;
	rating: number;
	comment: string | null;
	revision: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface ReviewWrite {
	rating: number;
	comment?: string | null;
}

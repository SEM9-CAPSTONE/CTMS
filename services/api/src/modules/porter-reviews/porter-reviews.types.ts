import type { ReviewParticipation } from "../trip-reviews/trip-reviews.types";

export const PORTER_REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PORTER_REVIEW_COMMENT_MAX_LENGTH = 2000;

export enum PorterReviewIneligibleReason {
	PARTICIPATION_NOT_COMPLETED = "PARTICIPATION_NOT_COMPLETED",
	WINDOW_EXPIRED = "WINDOW_EXPIRED",
	NO_ELIGIBLE_ASSIGNMENT = "NO_ELIGIBLE_ASSIGNMENT",
}

export interface PorterReviewRecord {
	id: string;
	bookingId: string;
	memberId: string;
	reviewerId: string;
	tripId: string;
	porterId: string;
	rating: number;
	comment: string | null;
	revision: number;
	moderationStatus: "visible" | "hidden";
	editExpiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface AssignedReviewPorter {
	porterId: string;
	porterName: string | null;
}

export interface PorterReviewView extends PorterReviewRecord {
	porterName: string | null;
	canEdit: boolean;
}

export interface PorterReviewContext {
	bookingId: string;
	tripId: string;
	serverTime: Date;
	completedAt: Date | null;
	expiresAt: Date | null;
	eligible: boolean;
	reason: PorterReviewIneligibleReason | null;
	porters: Array<AssignedReviewPorter & { canCreate: boolean }>;
	reviews: PorterReviewView[];
}

export interface PorterRatingSummary {
	porterId: string;
	ratingAverage: number | null;
	ratingCount: number;
}

export type PorterReviewParticipation = ReviewParticipation;

import type { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { BookingStatus } from "../profiles/entities/booking.entity";
import type {
	ImageStorageState,
	ModerationFlagType,
	ModerationHiddenSource,
	ModerationStatus,
	ModerationVerificationStatus,
} from "../trip-review-moderation/trip-review-moderation.types";

export enum ReviewTarget {
	TRIP = "trip",
	HOST = "host",
}

export const REVIEW_WINDOW_MS = 72 * 60 * 60 * 1000;
export const REVIEW_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

export const CAMPER_HIDDEN_NOTICE_TEMPLATE =
	"Chủ chuyến đã ẩn đánh giá này vì cho rằng nội dung vi phạm tiêu chuẩn cộng đồng. Lý do: [{reason}]";
export const PUBLIC_HIDDEN_PLACEHOLDER = "Đánh giá này đã bị chủ chuyến ẩn.";
export const CAMPER_RESTORED_NOTICE = "Chủ chuyến đã khôi phục đánh giá của bạn.";

export function formatCamperHiddenNotice(
	reason?: string | null,
	hiddenSource?: ModerationHiddenSource | null
): string {
	const resolvedReason = reason ?? "vi phạm tiêu chuẩn cộng đồng";
	if (hiddenSource === "ai") {
		return `Hệ thống đã tự động ẩn đánh giá này do phát hiện nội dung vi phạm tiêu chuẩn cộng đồng. Lý do: [${resolvedReason}]`;
	}
	return `Chủ chuyến đã ẩn đánh giá này vì cho rằng nội dung vi phạm tiêu chuẩn cộng đồng. Lý do: [${resolvedReason}]`;
}

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
	moderationStatus?: ModerationStatus;
	hiddenReason?: ModerationFlagType | null;
	firstHiddenAt?: Date | null;
	hiddenSource?: ModerationHiddenSource | null;
	moderationVerificationStatus?: ModerationVerificationStatus;
	imageStorageState?: ImageStorageState;
	moderationNotice?: string | null;
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

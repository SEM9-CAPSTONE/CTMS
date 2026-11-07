import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
	ImageStorageState,
	ModerationFlagType,
	ModerationStatus,
} from "../../trip-review-moderation/trip-review-moderation.types";
import {
	REVIEW_COMMENT_MAX_LENGTH,
	ReviewIneligibleReason,
	ReviewTarget,
	type TripReviewRecord,
} from "../trip-reviews.types";

export class TripReviewResponseDto implements TripReviewRecord {
	@ApiProperty({ type: [String] }) images!: string[];
	@ApiProperty({ required: false }) canEdit?: boolean;
	@ApiProperty({ required: false, type: String, format: "date-time" }) editExpiresAt?: Date;
	@ApiProperty({ format: "uuid" }) id!: string;
	@ApiProperty({ format: "uuid" }) bookingId!: string;
	@ApiProperty({ format: "uuid" }) memberId!: string;
	@ApiProperty({ format: "uuid" }) reviewerId!: string;
	@ApiProperty({ format: "uuid" }) tripId!: string;
	@ApiProperty({ format: "uuid" }) hostId!: string;
	@ApiProperty({ enum: ReviewTarget }) target!: ReviewTarget;
	@ApiProperty({ format: "uuid" }) targetId!: string;
	@ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
	@ApiProperty({ type: String, nullable: true, maxLength: REVIEW_COMMENT_MAX_LENGTH }) comment!:
		| string
		| null;
	@ApiProperty({ minimum: 1 }) revision!: number;
	@ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
	@ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
	@ApiPropertyOptional({ enum: ["visible", "hidden"] }) moderationStatus?: ModerationStatus;
	@ApiPropertyOptional({ nullable: true }) hiddenReason?: ModerationFlagType | null;
	@ApiPropertyOptional({
		enum: [
			"live",
			"quarantine_pending",
			"quarantined",
			"restore_pending",
			"quarantine_failed",
			"restore_failed",
		],
	})
	imageStorageState?: ImageStorageState;
	@ApiPropertyOptional({ nullable: true }) moderationNotice?: string | null;
}

export class TripReviewContextResponseDto {
	@ApiProperty({ format: "uuid" }) bookingId!: string;
	@ApiProperty({ format: "uuid" }) tripId!: string;
	@ApiProperty({ format: "uuid" }) hostId!: string;
	@ApiProperty() eligible!: boolean;
	@ApiProperty({ enum: ReviewIneligibleReason, nullable: true })
	reason!: ReviewIneligibleReason | null;
	@ApiProperty({ type: String, format: "date-time", nullable: true }) completedAt!: Date | null;
	@ApiProperty({ type: String, format: "date-time", nullable: true }) expiresAt!: Date | null;
	@ApiProperty({ type: String, format: "date-time" }) serverTime!: Date;
	@ApiProperty({ type: [TripReviewResponseDto] }) reviews!: TripReviewResponseDto[];
}

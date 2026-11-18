import { ApiProperty } from "@nestjs/swagger";
import {
	PORTER_REVIEW_COMMENT_MAX_LENGTH,
	type PorterReviewContext,
	PorterReviewIneligibleReason,
	type PorterReviewRecord,
} from "../porter-reviews.types";

export class PorterReviewResponseDto implements PorterReviewRecord {
	@ApiProperty({ format: "uuid" }) id!: string;
	@ApiProperty({ format: "uuid" }) bookingId!: string;
	@ApiProperty({ format: "uuid" }) memberId!: string;
	@ApiProperty({ format: "uuid" }) reviewerId!: string;
	@ApiProperty({ format: "uuid" }) tripId!: string;
	@ApiProperty({ format: "uuid" }) porterId!: string;
	@ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
	@ApiProperty({ type: String, nullable: true, maxLength: PORTER_REVIEW_COMMENT_MAX_LENGTH })
	comment!: string | null;
	@ApiProperty({ minimum: 1 }) revision!: number;
	@ApiProperty({ enum: ["visible", "hidden"] }) moderationStatus!: "visible" | "hidden";
	@ApiProperty({ type: String, format: "date-time" }) editExpiresAt!: Date;
	@ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
	@ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
}

export class OwnPorterReviewResponseDto extends PorterReviewResponseDto {
	@ApiProperty({ type: String, nullable: true }) porterName!: string | null;
	@ApiProperty() canEdit!: boolean;
}

export class EligibleReviewPorterDto {
	@ApiProperty({ format: "uuid" }) porterId!: string;
	@ApiProperty({ type: String, nullable: true }) porterName!: string | null;
	@ApiProperty() canCreate!: boolean;
}

export class PorterReviewContextResponseDto implements PorterReviewContext {
	@ApiProperty({ format: "uuid" }) bookingId!: string;
	@ApiProperty({ format: "uuid" }) tripId!: string;
	@ApiProperty({ type: String, format: "date-time" }) serverTime!: Date;
	@ApiProperty({ type: String, format: "date-time", nullable: true }) completedAt!: Date | null;
	@ApiProperty({ type: String, format: "date-time", nullable: true }) expiresAt!: Date | null;
	@ApiProperty() eligible!: boolean;
	@ApiProperty({ enum: PorterReviewIneligibleReason, nullable: true })
	reason!: PorterReviewIneligibleReason | null;
	@ApiProperty({ type: [EligibleReviewPorterDto] }) porters!: EligibleReviewPorterDto[];
	@ApiProperty({ type: [OwnPorterReviewResponseDto] }) reviews!: OwnPorterReviewResponseDto[];
}

import { ApiProperty } from "@nestjs/swagger";
import type {
	HostModerationDecision,
	ImageStorageState,
	ModerationFlagType,
	ModerationStatus,
} from "../trip-review-moderation.types";

export class ModerationDecisionResponseDto {
	@ApiProperty()
	decisionId!: string;

	@ApiProperty()
	reviewId!: string;

	@ApiProperty()
	revision!: number;

	@ApiProperty()
	decision!: HostModerationDecision;

	@ApiProperty({ nullable: true })
	reason!: ModerationFlagType | null;

	@ApiProperty()
	moderationStatus!: ModerationStatus;

	@ApiProperty()
	imageStorageState!: ImageStorageState;

	@ApiProperty({
		description:
			"True if Host attempted 'restore' but review remains hidden due to prior Admin moderation action",
	})
	adminActionedOverride!: boolean;

	@ApiProperty()
	message!: string;

	@ApiProperty()
	createdAt!: Date;
}

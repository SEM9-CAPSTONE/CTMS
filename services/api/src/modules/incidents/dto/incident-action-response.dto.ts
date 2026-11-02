import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IncidentActionType, IncidentStatus } from "../incidents.enums";

export class IncidentActionResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	incidentId!: string;

	@ApiProperty({ format: "uuid" })
	actorId!: string;

	@ApiPropertyOptional({ nullable: true })
	actorName!: string | null;

	@ApiPropertyOptional({ nullable: true })
	actorRole!: string | null;

	@ApiProperty({ enum: IncidentActionType })
	action!: IncidentActionType;

	@ApiPropertyOptional({ enum: IncidentStatus, nullable: true })
	fromStatus!: IncidentStatus | null;

	@ApiPropertyOptional({ enum: IncidentStatus, nullable: true })
	toStatus!: IncidentStatus | null;

	@ApiPropertyOptional({ nullable: true })
	note!: string | null;

	@ApiProperty({ format: "date-time" })
	createdAt!: string;
}

export class IncidentActionListResponseDto {
	@ApiProperty({ type: () => [IncidentActionResponseDto] })
	items!: IncidentActionResponseDto[];
}

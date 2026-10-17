import { ApiProperty } from "@nestjs/swagger";
import {
	IncidentCategory,
	IncidentLocationStatus,
	IncidentReportOutcome,
	IncidentSeverity,
	IncidentStatus,
} from "../incidents.enums";

export class IncidentLocationResponseDto {
	@ApiProperty()
	latitude!: number;

	@ApiProperty()
	longitude!: number;

	@ApiProperty()
	accuracyMeters!: number;

	@ApiProperty({ format: "date-time" })
	capturedAt!: string;
}

export class IncidentMediaResponseDto {
	@ApiProperty({ example: "/uploads/incidents/0b9f3c1e-....jpg" })
	url!: string;

	@ApiProperty({ example: "image/jpeg" })
	contentType!: string;

	@ApiProperty()
	sizeBytes!: number;

	@ApiProperty({ format: "date-time" })
	uploadedAt!: string;
}

export class IncidentResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	reporterId!: string;

	@ApiProperty({ nullable: true })
	reporterName!: string | null;

	@ApiProperty({ enum: IncidentCategory })
	category!: IncidentCategory;

	@ApiProperty({ enum: IncidentSeverity })
	severity!: IncidentSeverity;

	@ApiProperty({ enum: IncidentStatus })
	status!: IncidentStatus;

	@ApiProperty()
	description!: string;

	@ApiProperty({ format: "date-time" })
	occurredAt!: string;

	@ApiProperty({ type: IncidentLocationResponseDto, nullable: true })
	location!: IncidentLocationResponseDto | null;

	@ApiProperty({ enum: IncidentLocationStatus })
	locationStatus!: IncidentLocationStatus;

	@ApiProperty()
	capturedOffline!: boolean;

	@ApiProperty({ type: IncidentMediaResponseDto, nullable: true })
	media!: IncidentMediaResponseDto | null;

	@ApiProperty({ format: "date-time", description: "When the server first stored the incident" })
	receivedAt!: string;
}

export class ReportIncidentResponseDto {
	@ApiProperty({
		enum: IncidentReportOutcome,
		description: "`duplicate` means this id was already synchronized; nothing was changed",
	})
	outcome!: IncidentReportOutcome;

	@ApiProperty({ type: IncidentResponseDto })
	incident!: IncidentResponseDto;
}

export class IncidentListResponseDto {
	@ApiProperty({ type: IncidentResponseDto, isArray: true })
	items!: IncidentResponseDto[];
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsArray,
	IsBoolean,
	IsISO8601,
	IsOptional,
	IsString,
	IsUUID,
	ValidateNested,
} from "class-validator";
import { GeoJsonPointDto } from "./create-trip.dto";

export class ConfirmCheckpointArrivalDto {
	@ApiPropertyOptional({
		description: "Authoritative arrival timestamp. If omitted, current server time is used.",
		type: String,
		format: "date-time",
	})
	@IsOptional()
	@IsISO8601({ strict: true })
	arrivedAt?: string;

	@ApiPropertyOptional({
		description:
			"GPS location metadata at arrival when available. Do not fabricate coordinates if unavailable.",
		type: GeoJsonPointDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => GeoJsonPointDto)
	location?: GeoJsonPointDto | null;

	@ApiPropertyOptional({
		description:
			"Optional member IDs to record. If omitted, all joined members of the trip receive arrival records.",
		type: [String],
	})
	@IsOptional()
	@IsArray()
	@IsUUID("4", { each: true })
	memberIds?: string[];

	@ApiPropertyOptional({
		description: "True if captured while offline for later synchronization.",
		type: Boolean,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	capturedOffline?: boolean;

	@ApiPropertyOptional({
		description: "Client-generated idempotency or offline event ID to prevent duplicate records.",
		type: String,
	})
	@IsOptional()
	@IsString()
	syncId?: string;
}

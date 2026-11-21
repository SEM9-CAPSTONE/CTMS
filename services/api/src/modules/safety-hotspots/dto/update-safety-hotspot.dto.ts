import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export const HOTSPOT_SEVERITIES = ["low", "medium", "high"] as const;
export type HotspotSeverity = (typeof HOTSPOT_SEVERITIES)[number];

const trimmed = ({ value }: { value: unknown }) =>
	typeof value === "string" ? value.trim() : value;

/** What an Admin writes about a hotspot; position and evidence stay as detected. */
export class UpdateSafetyHotspotDto {
	@ApiProperty({ minLength: 1, maxLength: 120, example: "Dốc Vọng Cảnh" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	name!: string;

	@ApiProperty({ maxLength: 1000, description: "Empty clears the description" })
	@Transform(trimmed)
	@IsString()
	@MaxLength(1000)
	description!: string;

	@ApiProperty({ enum: HOTSPOT_SEVERITIES })
	@IsIn(HOTSPOT_SEVERITIES)
	severity!: HotspotSeverity;
}

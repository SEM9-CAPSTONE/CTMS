import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDefined, IsEnum, IsNotEmpty, IsString, MaxLength, Validate } from "class-validator";
import {
	type RouteDangerZoneGeometry,
	RouteDangerZoneSeverity,
} from "../entities/route-danger-zone.entity";
import {
	RouteDangerZoneGeometryConstraint,
	RouteDangerZoneRadiusConstraint,
} from "../validators/route-danger-zone-geometry.validator";

function trimmedString(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export class CreateRouteDangerZoneDto {
	@ApiProperty({
		oneOf: [
			{
				type: "object",
				required: ["type", "coordinates"],
				properties: {
					type: { type: "string", enum: ["Point"] },
					coordinates: {
						type: "array",
						minItems: 2,
						maxItems: 2,
						items: { type: "number" },
					},
				},
			},
			{
				type: "object",
				required: ["type", "coordinates"],
				properties: {
					type: { type: "string", enum: ["Polygon"] },
					coordinates: { type: "array", items: { type: "array" } },
				},
			},
		],
	})
	@IsDefined()
	@Validate(RouteDangerZoneGeometryConstraint)
	geometry!: RouteDangerZoneGeometry;

	@ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true })
	@Validate(RouteDangerZoneRadiusConstraint)
	radiusMeters?: number;

	@ApiProperty({ maxLength: 1000 })
	@Transform(({ value }) => trimmedString(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	description!: string;

	@ApiProperty({ enum: RouteDangerZoneSeverity })
	@IsEnum(RouteDangerZoneSeverity)
	severity!: RouteDangerZoneSeverity;
}

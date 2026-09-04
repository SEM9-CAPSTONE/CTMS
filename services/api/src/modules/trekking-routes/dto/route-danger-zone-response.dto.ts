import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	type RouteDangerZoneGeometry,
	RouteDangerZoneSeverity,
} from "../entities/route-danger-zone.entity";

export class RouteDangerZoneResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty({
		oneOf: [
			{ type: "object", properties: { type: { enum: ["Point"] }, coordinates: { type: "array" } } },
			{
				type: "object",
				properties: { type: { enum: ["Polygon"] }, coordinates: { type: "array" } },
			},
		],
	})
	geometry!: RouteDangerZoneGeometry;

	@ApiPropertyOptional({ nullable: true })
	radiusMeters!: number | null;

	@ApiProperty({ maxLength: 1000 })
	description!: string;

	@ApiProperty({ enum: RouteDangerZoneSeverity })
	severity!: RouteDangerZoneSeverity;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

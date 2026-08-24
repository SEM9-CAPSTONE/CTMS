import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrekkingRouteDifficulty, TrekkingRouteStatus } from "../entities/trekking-route.entity";
import { GeoJsonLineStringDto } from "./create-trekking-route.dto";

export class TrekkingRouteResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	campsiteId!: string;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional({ nullable: true })
	description!: string | null;

	@ApiProperty({ type: GeoJsonLineStringDto })
	geometry!: GeoJsonLineStringDto;

	@ApiProperty({ description: "PostGIS ST_Length result in meters" })
	lengthMeters!: number;

	@ApiProperty({ enum: TrekkingRouteDifficulty })
	difficulty!: TrekkingRouteDifficulty;

	@ApiProperty()
	expectedDurationMinutes!: number;

	@ApiProperty({ enum: TrekkingRouteStatus })
	status!: TrekkingRouteStatus;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

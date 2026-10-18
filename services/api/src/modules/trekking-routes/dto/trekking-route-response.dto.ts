import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrekkingRouteDifficulty, TrekkingRouteStatus } from "../entities/trekking-route.entity";
import { GeoJsonLineStringDto } from "./create-trekking-route.dto";

export class TrekkingRouteResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	hostId!: string;

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

	@ApiPropertyOptional({ nullable: true })
	latestRejectionReason?: string | null;

	@ApiPropertyOptional({ nullable: true })
	latestRejectionAt?: Date | null;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export class TrekkingRoutesPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedTrekkingRoutesResponseDto {
	@ApiProperty({ type: [TrekkingRouteResponseDto] })
	items!: TrekkingRouteResponseDto[];

	@ApiProperty({ type: TrekkingRoutesPaginationDto })
	pagination!: TrekkingRoutesPaginationDto;
}

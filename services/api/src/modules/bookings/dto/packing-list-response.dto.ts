import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrekkingRouteDifficulty } from "../../trekking-routes/entities/trekking-route.entity";
import { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import { PackingListItemResponseDto } from "./packing-list-item-response.dto";

export class PackingListContextDto {
	@ApiProperty({ minimum: 0 })
	durationNights!: number;

	@ApiProperty({ enum: ["day_trip", "overnight"] })
	tripType!: "day_trip" | "overnight";

	@ApiPropertyOptional({ enum: TrekkingRouteDifficulty, nullable: true })
	difficulty!: TrekkingRouteDifficulty | null;

	@ApiProperty({ minimum: 1 })
	memberCount!: number;

	@ApiPropertyOptional({ enum: RiskLevel, nullable: true })
	weatherRiskLevel!: RiskLevel | null;
}

export class PackingListResponseDto {
	@ApiProperty({ format: "uuid" })
	bookingId!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ type: PackingListContextDto })
	context!: PackingListContextDto;

	@ApiProperty({ type: PackingListItemResponseDto, isArray: true })
	items!: PackingListItemResponseDto[];
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class PorterLedTripHistoryQueryDto {
	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 5, minimum: 1, maximum: 20 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(20)
	limit = 5;
}

export class PorterLedTripHistoryItemDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty()
	tripTitle!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty()
	routeName!: string;

	@ApiProperty()
	startsAt!: Date;

	@ApiProperty()
	endsAt!: Date;

	@ApiProperty({ enum: ["lead"] })
	role!: "lead";

	@ApiProperty({ enum: ["completed"] })
	status!: "completed";
}

export class PorterLedTripHistoryPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedPorterLedTripHistoryResponseDto {
	@ApiProperty({ type: [PorterLedTripHistoryItemDto] })
	items!: PorterLedTripHistoryItemDto[];

	@ApiProperty({ type: PorterLedTripHistoryPaginationDto })
	pagination!: PorterLedTripHistoryPaginationDto;
}

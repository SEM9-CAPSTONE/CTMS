import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";
import { CampsiteMediaResponseDto } from "./campsite-response.dto";

export class CampsiteDetailDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional({ nullable: true })
	description!: string | null;

	@ApiProperty()
	latitude!: number;

	@ApiProperty()
	longitude!: number;

	@ApiProperty()
	province!: string;

	@ApiProperty()
	policies!: Record<string, unknown> | null;

	@ApiProperty()
	operatingHours!: Record<string, unknown> | null;

	@ApiPropertyOptional({ nullable: true })
	seasonStartDate!: string | null;

	@ApiPropertyOptional({ nullable: true })
	seasonEndDate!: string | null;

	@ApiPropertyOptional({ nullable: true })
	maxAdvanceBookingDays!: number | null;

	@ApiPropertyOptional({ nullable: true })
	minNights!: number | null;

	@ApiPropertyOptional({ nullable: true })
	maxNights!: number | null;

	@ApiProperty({ enum: CampsiteStatus })
	status!: CampsiteStatus;

	@ApiProperty({ type: [CampsiteMediaResponseDto] })
	media!: CampsiteMediaResponseDto[];

	@ApiProperty({ type: Array })
	upcomingTrips: unknown[] = [];
}

export function toCampsiteDetail(
	campsite: Campsite,
	media: CampsiteMediaResponseDto[],
	latitude: number,
	longitude: number
): CampsiteDetailDto {
	return {
		id: campsite.id,
		name: campsite.name,
		description: campsite.description,
		latitude,
		longitude,
		province: campsite.province,
		policies: campsite.policies,
		operatingHours: campsite.operatingHours,
		seasonStartDate: campsite.seasonStartDate,
		seasonEndDate: campsite.seasonEndDate,
		maxAdvanceBookingDays: campsite.maxAdvanceBookingDays,
		minNights: campsite.minNights,
		maxNights: campsite.maxNights,
		status: campsite.status,
		media: media.map((m) => ({
			id: m.id,
			url: m.url,
			type: m.type,
			sortOrder: m.sortOrder,
		})),
		upcomingTrips: [],
	};
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CampsiteMedia } from "../entities/campsite-media.entity";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";
import type { Zone } from "../entities/zone.entity";

export class CampsiteMediaResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	url!: string;

	@ApiProperty()
	type!: string;

	@ApiProperty()
	sortOrder!: number;
}

export class CampsiteZoneResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	maxTents!: number;

	@ApiProperty()
	maxPeople!: number;

	@ApiProperty()
	basePrice!: number;

	@ApiPropertyOptional({ type: [String], nullable: true })
	amenities!: string[] | null;

	@ApiPropertyOptional({ nullable: true })
	terrainNote!: string | null;

	@ApiProperty()
	status!: string;
}

export class CampsiteResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	hostId!: string;

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

	@ApiPropertyOptional({ nullable: true })
	rejectionReason!: string | null;

	@ApiProperty({ type: [CampsiteMediaResponseDto] })
	media!: CampsiteMediaResponseDto[];

	@ApiProperty({ type: [CampsiteZoneResponseDto] })
	zones!: CampsiteZoneResponseDto[];

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export function toCampsiteResponse(
	campsite: Campsite,
	media: CampsiteMedia[],
	zones: Zone[],
	latitude: number,
	longitude: number
): CampsiteResponseDto {
	return {
		id: campsite.id,
		hostId: campsite.hostId,
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
		rejectionReason: campsite.rejectionReason,
		media: media.map((item) => ({
			id: item.id,
			url: item.url,
			type: item.type,
			sortOrder: item.sortOrder,
		})),
		zones: zones.map((zone) => ({
			id: zone.id,
			name: zone.name,
			maxTents: zone.maxTents,
			maxPeople: zone.maxPeople,
			basePrice: Number(zone.basePrice),
			amenities: zone.amenities,
			terrainNote: zone.terrainNote,
			status: zone.status,
		})),
		createdAt: campsite.createdAt,
		updatedAt: campsite.updatedAt,
	};
}

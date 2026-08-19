import { ApiProperty } from "@nestjs/swagger";
import type { CampsiteImage } from "../entities/campsite-image.entity";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";

export class CampsiteImageResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	url!: string;

	@ApiProperty()
	type!: string;

	@ApiProperty()
	displayOrder!: number;
}

export class CampsiteResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	hostId!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	description!: string;

	@ApiProperty()
	latitude!: number;

	@ApiProperty()
	longitude!: number;

	@ApiProperty()
	province!: string;

	@ApiProperty()
	city!: string;

	@ApiProperty()
	policies!: string;

	@ApiProperty()
	operatingHours!: string;

	@ApiProperty({ enum: CampsiteStatus })
	status!: CampsiteStatus;

	@ApiProperty({ type: [CampsiteImageResponseDto] })
	images!: CampsiteImageResponseDto[];

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export function toCampsiteResponse(
	campsite: Campsite,
	images: CampsiteImage[]
): CampsiteResponseDto {
	return {
		id: campsite.id,
		hostId: campsite.hostId,
		name: campsite.name,
		description: campsite.description,
		latitude: Number(campsite.latitude),
		longitude: Number(campsite.longitude),
		province: campsite.province,
		city: campsite.city,
		policies: campsite.policies,
		operatingHours: campsite.operatingHours,
		status: campsite.status,
		images: images.map((image) => ({
			id: image.id,
			url: image.url,
			type: image.type,
			displayOrder: image.displayOrder,
		})),
		createdAt: campsite.createdAt,
		updatedAt: campsite.updatedAt,
	};
}

import { ApiProperty } from "@nestjs/swagger";
import { PorterAvailabilityStatus, type PorterProfile } from "../entities/porter-profile.entity";

export class PorterProfileResponseDto {
	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ minimum: 0 })
	experienceYears!: number;

	@ApiProperty({ type: [String] })
	certifications!: string[];

	@ApiProperty({ type: [String] })
	languages!: string[];

	@ApiProperty({ enum: PorterAvailabilityStatus })
	availabilityStatus!: PorterAvailabilityStatus;

	@ApiProperty({ minimum: 0, maximum: 5 })
	ratingAvg!: number;

	@ApiProperty({ minimum: 0 })
	completedTrips!: number;

	@ApiProperty({ minimum: 0 })
	version!: number;

	@ApiProperty({ type: Date, nullable: true })
	createdAt!: Date | null;

	@ApiProperty({ type: Date, nullable: true })
	updatedAt!: Date | null;
}

export function toPorterProfileResponse(profile: PorterProfile): PorterProfileResponseDto {
	return {
		porterId: profile.porterId,
		experienceYears: profile.experienceYears,
		certifications: profile.certifications,
		languages: profile.languages,
		availabilityStatus: profile.availabilityStatus,
		ratingAvg: Number(profile.ratingAvg),
		completedTrips: profile.completedTrips,
		version: profile.version,
		createdAt: profile.createdAt,
		updatedAt: profile.updatedAt,
	};
}

export function defaultPorterProfileResponse(porterId: string): PorterProfileResponseDto {
	return {
		porterId,
		experienceYears: 0,
		certifications: [],
		languages: [],
		availabilityStatus: PorterAvailabilityStatus.UNAVAILABLE,
		ratingAvg: 0,
		completedTrips: 0,
		version: 0,
		createdAt: null,
		updatedAt: null,
	};
}

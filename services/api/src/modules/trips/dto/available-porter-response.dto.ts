import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PorterAvailabilityStatus } from "../../profiles/entities/porter-profile.entity";
import { PorterRouteProficiency } from "../../profiles/entities/porter-route-qualification.entity";

export class AvailablePorterResponseDto {
	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ type: String, nullable: true })
	displayName!: string | null;

	@ApiProperty()
	experienceYears!: number;

	@ApiProperty({ enum: PorterAvailabilityStatus })
	availabilityStatus!: PorterAvailabilityStatus;

	@ApiProperty()
	ratingAvg!: number;

	@ApiProperty()
	completedTrips!: number;

	@ApiPropertyOptional({
		enum: PorterRouteProficiency,
		description: "Exact-Route verified proficiency; returned only for lead searches",
	})
	proficiency?: PorterRouteProficiency;
}

export class AvailablePortersPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedAvailablePortersResponseDto {
	@ApiProperty({ type: [AvailablePorterResponseDto] })
	items!: AvailablePorterResponseDto[];

	@ApiProperty({ type: AvailablePortersPaginationDto })
	pagination!: AvailablePortersPaginationDto;
}

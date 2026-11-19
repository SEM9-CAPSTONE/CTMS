import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PorterAvailabilityStatus } from "../../profiles/entities/porter-profile.entity";
import { PorterRouteProficiency } from "../../profiles/entities/porter-route-qualification.entity";

export class AvailablePorterCertificateItemDto {
	@ApiProperty({ description: "Loại chứng chỉ (wfa, rescue, guide_card, other)", example: "wfa" })
	type!: string;

	@ApiProperty({ description: "Tên chứng chỉ", example: "Chứng chỉ Sơ cấp cứu dã ngoại (WFA)" })
	name!: string;
}

export class AvailablePorterResponseDto {
	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ type: String, nullable: true })
	displayName!: string | null;

	@ApiProperty({ type: String, nullable: true })
	avatarUrl!: string | null;

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

	@ApiProperty({
		type: [AvailablePorterCertificateItemDto],
		description: "Danh sách chứng chỉ đã xác minh và còn hạn",
	})
	certificates!: AvailablePorterCertificateItemDto[];

	@ApiProperty({ type: [String], description: "Tên các chứng chỉ đã xác minh còn hạn" })
	certifications!: string[];
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

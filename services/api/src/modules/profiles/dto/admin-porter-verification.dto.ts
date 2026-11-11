import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";
import { PorterVerificationStatus } from "../entities/porter-verification.entity";
import { PorterVerificationResponseDto } from "./porter-verification-response.dto";

function trimmedOrUndefined(value: unknown): unknown {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

export class ListPorterVerificationsQueryDto {
	@ApiPropertyOptional({ enum: PorterVerificationStatus })
	@IsOptional()
	@IsEnum(PorterVerificationStatus)
	status?: PorterVerificationStatus;

	@ApiPropertyOptional({ description: "Search by full name, email, or phone", maxLength: 100 })
	@IsOptional()
	@Transform(({ value }) => trimmedOrUndefined(value))
	@IsString()
	@MaxLength(100)
	search?: string;

	@ApiPropertyOptional({ default: 1, minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;
}

export class RejectPorterVerificationDto {
	@ApiProperty({ maxLength: 500, description: "Reason shown to the Porter" })
	@Transform(({ value }) => trimmedOrUndefined(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	reason!: string;
}

export class AdminPorterVerificationSummaryDto {
	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ type: String, nullable: true })
	fullName!: string | null;

	@ApiProperty({ type: String, nullable: true })
	email!: string | null;

	@ApiProperty({ type: String, nullable: true })
	phone!: string | null;

	@ApiProperty({ enum: PorterVerificationStatus })
	status!: PorterVerificationStatus;

	@ApiProperty({ type: Date, nullable: true })
	submittedAt!: Date | null;

	@ApiProperty({ type: Date, nullable: true })
	reviewedAt!: Date | null;

	@ApiProperty()
	documentCount!: number;
}

export class AdminPorterVerificationDetailDto extends PorterVerificationResponseDto {
	@ApiProperty({ type: String, nullable: true })
	fullName!: string | null;

	@ApiProperty({ type: String, nullable: true })
	email!: string | null;

	@ApiProperty({ type: String, nullable: true })
	phone!: string | null;

	@ApiProperty({ type: String, nullable: true, format: "uuid" })
	reviewedBy!: string | null;

	@ApiProperty({ type: Number, nullable: true })
	experienceYears!: number | null;

	@ApiProperty({ type: [String] })
	certifications!: string[];
}

export class PorterVerificationsPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedPorterVerificationsResponseDto {
	@ApiProperty({ type: [AdminPorterVerificationSummaryDto] })
	items!: AdminPorterVerificationSummaryDto[];

	@ApiProperty({ type: PorterVerificationsPaginationDto })
	pagination!: PorterVerificationsPaginationDto;
}

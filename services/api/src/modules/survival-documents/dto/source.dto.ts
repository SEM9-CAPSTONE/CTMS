import { UnprocessableEntityException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type, plainToInstance } from "class-transformer";
import {
	IsBoolean,
	IsDateString,
	IsDefined,
	IsEnum,
	IsIn,
	IsInt,
	IsJSON,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
	validateSync,
} from "class-validator";
import {
	Classification,
	DocumentStatus,
	MedicalStatus,
	RightsStatus,
} from "../survival-documents.types";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export class SourceMetadataDto {
	@ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(250) sourceTitle!: string;
	@ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(250) publisher!: string;
	@ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) sourceUrl?: string;
	@ApiProperty({ enum: Classification }) @IsEnum(Classification) classification!: Classification;
	@ApiProperty() @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/) locale!: string;
	@ApiProperty() @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/) originalLocale!: string;
	@ApiPropertyOptional() @IsOptional() @IsDateString({ strict: true }) sourcePublishedAt?: string;
	@ApiProperty() @IsDateString({ strict: true }) retrievedAt!: string;
	@ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(250) licenseType!: string;
	@ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) licenseUrl?: string;
	@ApiProperty()
	@Transform(trim)
	@IsString()
	@MinLength(10)
	@MaxLength(5000)
	permissionEvidence!: string;
	@ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(2000) changeSummary!: string;
	@ApiProperty() @Transform(trim) @IsString() @MinLength(3) @MaxLength(2000) attribution!: string;
	@ApiPropertyOptional() @IsOptional() @IsUUID() originalVersionId?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(10)
	@MaxLength(3000)
	adaptationDisclaimer?: string;
}
export class UploadSourceDto {
	@ApiProperty({ description: "JSON-encoded SourceMetadataDto" })
	@IsString()
	@IsJSON()
	metadata!: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	expectedDocumentRevision?: number;
}
export class RevisionDto {
	@ApiProperty() @IsInt() @Min(1) expectedRevision!: number;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(2000)
	reason?: string;
}
export class EditSourceDto extends RevisionDto {
	@ApiProperty({ type: SourceMetadataDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => SourceMetadataDto)
	metadata!: SourceMetadataDto;
}
export class SourceRightsDto {
	@ApiProperty({ enum: RightsStatus }) @IsEnum(RightsStatus) rightsReviewStatus!: RightsStatus;
	@ApiProperty() @IsBoolean() sourceReviewConfirmed!: boolean;
	@ApiProperty() @IsBoolean() internalRagUseAllowed!: boolean;
	@ApiProperty() @IsBoolean() offlineRedistributionAllowed!: boolean;
	@ApiProperty() @IsBoolean() translationAllowed!: boolean;
	@ApiProperty({ enum: MedicalStatus })
	@IsEnum(MedicalStatus)
	medicalContentReviewStatus!: MedicalStatus;
	@ApiProperty() @Transform(trim) @IsString() @MinLength(10) @MaxLength(5000) evidence!: string;
}
export class ReviewSourceDto extends RevisionDto {
	@ApiProperty({ enum: ["approve", "reject"] }) @IsIn(["approve", "reject"]) decision!:
		| "approve"
		| "reject";
	@ApiProperty({ type: SourceRightsDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => SourceRightsDto)
	rights!: SourceRightsDto;
}
export class ListSourcesDto {
	@ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
	@ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
	@ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) search?: string;
	@ApiPropertyOptional({ enum: Classification })
	@IsOptional()
	@IsEnum(Classification)
	classification?: Classification;
	@ApiPropertyOptional() @IsOptional() @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/) locale?: string;
	@ApiPropertyOptional({ enum: DocumentStatus })
	@IsOptional()
	@IsEnum(DocumentStatus)
	status?: DocumentStatus;
}
export function parseMetadata(value: string): SourceMetadataDto {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw invalidSource("Thông tin tài liệu không hợp lệ.");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
		throw invalidSource("Thông tin tài liệu không hợp lệ.");
	const dto = plainToInstance(SourceMetadataDto, parsed);
	if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
		throw invalidSource("Vui lòng kiểm tra thông tin nguồn, ngôn ngữ và minh chứng quyền sử dụng.");
	return dto;
}
export function invalidSource(message: string): UnprocessableEntityException {
	return new UnprocessableEntityException({ code: "INVALID_SOURCE", message });
}

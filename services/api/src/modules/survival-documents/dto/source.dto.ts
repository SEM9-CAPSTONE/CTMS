import { UnprocessableEntityException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type, plainToInstance } from "class-transformer";
import {
	IsBoolean,
	IsDateString,
	IsDefined,
	IsEnum,
	IsInt,
	IsJSON,
	IsObject,
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
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(2)
	@MaxLength(250)
	publisher?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(2000)
	sourceUrl?: string;
	@ApiProperty({ enum: Classification }) @IsEnum(Classification) classification!: Classification;
	@ApiProperty() @Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/) locale!: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
	originalLocale?: string;
	@ApiPropertyOptional() @IsOptional() @IsDateString({ strict: true }) sourcePublishedAt?: string;
	@ApiPropertyOptional() @IsOptional() @IsDateString({ strict: true }) retrievedAt?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(2)
	@MaxLength(250)
	licenseType?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MaxLength(2000)
	licenseUrl?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(10)
	@MaxLength(5000)
	permissionEvidence?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(3)
	@MaxLength(2000)
	changeSummary?: string;
	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trim)
	@IsString()
	@MinLength(3)
	@MaxLength(2000)
	attribution?: string;
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
export class ImportSourceDto {
	@ApiProperty({ description: "Direct HTTPS URL of the PDF" })
	@Transform(trim)
	@IsString()
	@Matches(/^https:\/\//i)
	@MaxLength(2000)
	sourceUrl!: string;
	@ApiProperty({ type: SourceMetadataDto })
	@IsDefined()
	@IsObject()
	@ValidateNested()
	@Type(() => SourceMetadataDto)
	metadata!: SourceMetadataDto;
	@ApiPropertyOptional()
	@IsOptional()
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
export class DeleteSourceDto {
	@ApiProperty()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	expectedRevision!: number;
}
export class EditSourceDto extends RevisionDto {
	@ApiProperty({ type: SourceMetadataDto })
	@IsDefined()
	@IsObject()
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
export class PublishSourceDto extends RevisionDto {
	@ApiPropertyOptional({ type: SourceRightsDto })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => SourceRightsDto)
	rights?: SourceRightsDto;
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
	return validateMetadata(parsed);
}
export function validateMetadata(value: unknown): SourceMetadataDto {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw invalidSource("Thông tin tài liệu không hợp lệ.");
	const dto = plainToInstance(SourceMetadataDto, value);
	if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
		throw invalidSource("Vui lòng kiểm tra tên tài liệu, danh mục, ngôn ngữ và metadata đã nhập.");
	return dto;
}
export function invalidSource(message: string): UnprocessableEntityException {
	return new UnprocessableEntityException({ code: "INVALID_SOURCE", message });
}

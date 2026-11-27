import { Transform, Type } from "class-transformer";
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { normalizeTermsVersion } from "../terms-content";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class TermsSubsectionInputDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	code!: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title!: string;

	@IsString()
	@IsNotEmpty()
	body!: string;
}

export class TermsSectionInputDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	number!: number;

	@IsString()
	@IsNotEmpty()
	@MaxLength(120)
	slug!: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title!: string;

	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => TermsSubsectionInputDto)
	subsections!: TermsSubsectionInputDto[];

	@IsOptional()
	@IsString()
	callout?: string;
}

export class CreateTermsVersionDto {
	@Transform(({ value }) => (typeof value === "string" ? normalizeTermsVersion(value) : value))
	@IsString({ message: "Mã phiên bản phải là chuỗi hợp lệ." })
	@IsNotEmpty({ message: "Mã phiên bản là bắt buộc." })
	@MaxLength(32)
	version!: string;

	@IsString({ message: "Tiêu đề phải là chuỗi hợp lệ." })
	@IsNotEmpty({ message: "Tiêu đề điều khoản là bắt buộc." })
	@MaxLength(200)
	title!: string;

	@IsOptional()
	@IsString()
	summary?: string | null;

	@IsString()
	@Matches(ISO_DATE_PATTERN, { message: "Ngày hiệu lực phải theo định dạng YYYY-MM-DD." })
	effectiveDate!: string;

	@IsArray()
	@ArrayMinSize(1, { message: "Cần ít nhất 1 mục điều khoản." })
	@ValidateNested({ each: true })
	@Type(() => TermsSectionInputDto)
	sections!: TermsSectionInputDto[];

	@IsOptional()
	@IsBoolean()
	requiresReconsent?: boolean;
}

export class UpdateTermsVersionDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	summary?: string | null;

	@IsOptional()
	@IsString()
	@Matches(ISO_DATE_PATTERN, { message: "Ngày hiệu lực phải theo định dạng YYYY-MM-DD." })
	effectiveDate?: string;

	@IsOptional()
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => TermsSectionInputDto)
	sections?: TermsSectionInputDto[];

	@IsOptional()
	@IsBoolean()
	requiresReconsent?: boolean;
}

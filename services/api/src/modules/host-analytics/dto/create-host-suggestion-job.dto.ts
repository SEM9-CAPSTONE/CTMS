import {
	IsArray,
	IsBoolean,
	IsISO8601,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";

export class CreateHostSuggestionJobDto {
	@IsOptional()
	@IsISO8601()
	from?: string;

	@IsOptional()
	@IsISO8601()
	to?: string;

	@IsOptional()
	@IsString()
	@MaxLength(32)
	areaCode?: string;

	@IsOptional()
	@IsString()
	@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
	monthHint?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	excludeRouteIds?: string[];

	@IsOptional()
	@IsBoolean()
	refresh?: boolean;
}

import {
	Equals,
	IsBoolean,
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
} from "class-validator";

export class VerifyContentDto {
	@IsUUID() extractionId!: string;
	@IsUUID() requestId!: string;
	@IsInt() @Min(0) expectedRevision!: number;
	@IsIn(["confirm", "correct", "describe", "exclude"]) action!:
		| "confirm"
		| "correct"
		| "describe"
		| "exclude";
	@IsString() @MaxLength(30000) text!: string;
	@Equals(true) source_checked!: boolean;
	@Equals(true) context_checked!: boolean;
	@IsBoolean() visual_checked!: boolean;
	@IsOptional() @IsString() @MaxLength(1000) reason?: string;
	@IsOptional() @IsString() @MaxLength(120) after_item_ref?: string;
	@IsOptional() @IsObject() block_texts?: Record<string, string>;
}

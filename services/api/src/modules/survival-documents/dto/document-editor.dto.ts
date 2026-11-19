import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { EditAction, type EditOperation } from "../document-editor.policy";

export class StartDocumentEditDto {
	@IsInt() @Min(1) expectedDocumentRevision!: number;
}

export class EditorRevisionDto {
	@IsInt() @Min(1) expectedRevision!: number;
	@IsUUID() requestId!: string;
}

class EditorOperationDto implements EditOperation {
	@IsEnum(EditAction) action!: EditAction;
	@IsOptional() @IsString() @MaxLength(64) targetId?: string;
	@IsOptional() @IsUUID() fromVersionId?: string;
	@IsOptional() @IsString() @MaxLength(64) fromSectionId?: string;
	@IsOptional() @IsInt() @Min(0) position?: number;
	@IsOptional() @IsString() @MaxLength(300) heading?: string;
	@IsOptional() @IsString() @MaxLength(12000) text?: string;
}

export class PlanDocumentEditDto extends EditorRevisionDto {
	@IsOptional() @IsString() @MaxLength(2500) instruction?: string;
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(40)
	@ValidateNested({ each: true })
	@Type(() => EditorOperationDto)
	operations?: EditorOperationDto[];
	@IsOptional() @IsString() @MaxLength(300) title?: string;
}

export class ConfirmDocumentEditDto extends EditorRevisionDto {
	@IsString() @MaxLength(1800) reviewBasis!: string;
}

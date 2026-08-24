import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, Validate, ValidateNested } from "class-validator";
import { CreateCampsiteMediaDto, MediaSortOrderSequenceConstraint } from "./create-campsite.dto";

export class UpdateCampsiteMediaDto {
	@ApiProperty({ type: [CreateCampsiteMediaDto], minItems: 1, maxItems: 10 })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(10)
	@Validate(MediaSortOrderSequenceConstraint)
	@ValidateNested({ each: true })
	@Type(() => CreateCampsiteMediaDto)
	media!: CreateCampsiteMediaDto[];
}

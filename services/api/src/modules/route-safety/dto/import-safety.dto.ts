import { ApiProperty } from "@nestjs/swagger";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsNotEmpty,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";
import { SAFETY_IMPORT_LIMIT } from "../route-safety.policy";

export class ImportSafetyDto {
	@ApiProperty({ example: "APPROVED_FILE" })
	@IsString()
	@Matches(/^[A-Z][A-Z0-9_]{0,63}$/)
	source!: string;

	@ApiProperty({ description: "Data license, agreement or approval reference permitting reuse" })
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	permissionReference!: string;

	@ApiProperty({
		type: "array",
		items: { type: "object", additionalProperties: true },
		maxItems: SAFETY_IMPORT_LIMIT,
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(SAFETY_IMPORT_LIMIT)
	features!: unknown[];
}

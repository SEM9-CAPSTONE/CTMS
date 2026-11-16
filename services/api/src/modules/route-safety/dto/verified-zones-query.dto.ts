import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";

export class VerifiedZonesQueryDto {
	@ApiProperty({ minimum: -180, maximum: 180 })
	@Type(() => Number)
	@IsNumber()
	@Min(-180)
	@Max(180)
	west!: number;

	@ApiProperty({ minimum: -90, maximum: 90 })
	@Type(() => Number)
	@IsNumber()
	@Min(-90)
	@Max(90)
	south!: number;

	@ApiProperty({ minimum: -180, maximum: 180 })
	@Type(() => Number)
	@IsNumber()
	@Min(-180)
	@Max(180)
	east!: number;

	@ApiProperty({ minimum: -90, maximum: 90 })
	@Type(() => Number)
	@IsNumber()
	@Min(-90)
	@Max(90)
	north!: number;
}

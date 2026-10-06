import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, Min, ValidateIf } from "class-validator";
import { PorterRouteProficiency } from "../entities/porter-route-qualification.entity";

export class UpsertPorterRouteQualificationDto {
	@ApiProperty({ enum: PorterRouteProficiency })
	@IsEnum(PorterRouteProficiency)
	proficiency!: PorterRouteProficiency;

	@ApiProperty({ minimum: 0, example: 3 })
	@IsInt()
	@Min(0)
	timesLed!: number;

	@ApiPropertyOptional({ minimum: 1, description: "Required only when the claim exists" })
	@ValidateIf((_dto: UpsertPorterRouteQualificationDto, value: unknown) => value !== undefined)
	@IsInt()
	@Min(1)
	expectedVersion?: number;
}

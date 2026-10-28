import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
	MinLength,
} from "class-validator";
import { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";
import { LevelRequestStatus } from "./level-requests.types";
import { ListLevelQualificationsDto } from "./porter-levels.dto";
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export class RequestVersionDto {
	@ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}
export class CreateLevelRequestDto {
	@ApiProperty({ format: "uuid" }) @IsUUID() routeId!: string;
	@ApiProperty({ enum: PorterRouteProficiency })
	@IsEnum(PorterRouteProficiency)
	targetLevel!: PorterRouteProficiency;
	@ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) reason!: string;
	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	expectedQualificationVersion!: number;
}
export class ResubmitLevelRequestDto extends RequestVersionDto {
	@ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) reason!: string;
}
export class ReviewLevelRequestDto extends RequestVersionDto {
	@ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) reason!: string;
}
export class ApproveLevelRequestDto extends ReviewLevelRequestDto {
	@ApiProperty() @IsInt() @Min(1) expectedQualificationVersion!: number;
	@ApiProperty() @IsInt() @Min(1) expectedPolicyVersion!: number;
	@ApiProperty() @IsString() @MinLength(64) @MaxLength(64) expectedDossierHash!: string;
}
export class ListLevelRequestsDto extends ListLevelQualificationsDto {
	@ApiPropertyOptional({ description: "Search Porter or Route name" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;
	@ApiPropertyOptional({ enum: LevelRequestStatus })
	@IsOptional()
	@IsEnum(LevelRequestStatus)
	status?: LevelRequestStatus;
	@ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() routeId?: string;
	@ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() porterId?: string;
}

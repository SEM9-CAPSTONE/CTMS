import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	IsDateString,
	IsDefined,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { RouteDangerZoneSeverity } from "../../trekking-routes/entities/route-danger-zone.entity";
import { DangerZoneHazardType } from "../danger-zone-proposals.enums";

export class ProposalGpsDto {
	@ApiProperty() @IsNumber() @Min(-90) @Max(90) latitude!: number;
	@ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!: number;
	@ApiProperty() @IsNumber() @Min(0) accuracyMeters!: number;
	@ApiProperty() @IsDateString() capturedAt!: string;
}

export class PorterDangerZoneProposalDto {
	@ApiProperty() @IsUUID("4") clientRequestId!: string;
	@ApiProperty({ enum: DangerZoneHazardType })
	@IsEnum(DangerZoneHazardType)
	hazardType!: DangerZoneHazardType;
	@ApiProperty({ enum: RouteDangerZoneSeverity })
	@IsEnum(RouteDangerZoneSeverity)
	severity!: RouteDangerZoneSeverity;
	@ApiProperty({ maxLength: 1000 })
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	description!: string;
	@ApiProperty() @IsDateString() observedAt!: string;
	@ApiProperty({ type: ProposalGpsDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => ProposalGpsDto)
	location!: ProposalGpsDto;
}

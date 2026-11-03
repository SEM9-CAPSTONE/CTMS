import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { SosStatus } from "../sos.enums";

export class GetHostSosQueryDto {
	@ApiPropertyOptional({ example: 1, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({ example: 10, default: 10 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	limit?: number = 10;

	@ApiPropertyOptional({ enum: SosStatus })
	@IsOptional()
	@IsEnum(SosStatus)
	status?: SosStatus;

	@ApiPropertyOptional({ description: "Filter by Trip UUID" })
	@IsOptional()
	@IsUUID()
	tripId?: string;

	@ApiPropertyOptional({
		description: "Search by camper name, email, trip title, or emergency type",
	})
	@IsOptional()
	@IsString()
	search?: string;
}

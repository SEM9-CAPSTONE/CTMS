import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class PorterParticipationsQueryDto {
	@ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(10000)
	page = 1;

	@ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	limit = 10;
}

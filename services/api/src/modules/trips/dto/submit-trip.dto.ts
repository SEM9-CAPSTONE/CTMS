import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class SubmitTripDto {
	@ApiPropertyOptional({
		description:
			"Required (true) when the latest weather forecast for the Trip schedule is Red: the Host confirms they are aware of the high risk.",
	})
	@IsOptional()
	@IsBoolean()
	acknowledgeWeatherRisk?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined, IsIn, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { GeoJsonLineStringDto } from "../../trekking-routes/dto/create-trekking-route.dto";
import { SAFETY_PROVIDERS, type SafetyProvider } from "../live-safety.types";

export class AnalyzeRouteDto {
	@ApiPropertyOptional({
		enum: SAFETY_PROVIDERS,
		description:
			"Analyze a single provider for independent progressive preview; omit to collect all providers",
	})
	@IsOptional()
	@IsIn(SAFETY_PROVIDERS)
	source?: SafetyProvider;

	@ApiPropertyOptional({
		format: "uuid",
		description: "An owned route; geometry may contain unsaved edits",
	})
	@IsOptional()
	@IsUUID()
	routeId?: string;

	@ApiProperty({ type: GeoJsonLineStringDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => GeoJsonLineStringDto)
	geometry!: GeoJsonLineStringDto;
}

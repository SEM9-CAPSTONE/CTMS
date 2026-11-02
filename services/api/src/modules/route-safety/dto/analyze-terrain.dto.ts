import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined, ValidateNested } from "class-validator";
import { GeoJsonLineStringDto } from "../../trekking-routes/dto/create-trekking-route.dto";

export class AnalyzeTerrainDto {
	@ApiProperty({ type: GeoJsonLineStringDto })
	@IsDefined()
	@ValidateNested()
	@Type(() => GeoJsonLineStringDto)
	geometry!: GeoJsonLineStringDto;
}

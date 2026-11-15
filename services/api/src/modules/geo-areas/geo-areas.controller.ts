import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GeoAreaResponseDto } from "./dto/geo-area-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { GeoAreasService } from "./geo-areas.service";

@ApiTags("geo-areas")
@ApiBearerAuth()
@Controller("geo-areas")
@UseGuards(JwtAuthGuard)
export class GeoAreasController {
	constructor(private readonly service: GeoAreasService) {}

	@Get()
	@ApiOperation({ summary: "List active reporting areas used for Trips and revenue reports" })
	@ApiResponse({ status: 200, type: GeoAreaResponseDto, isArray: true })
	async list(): Promise<GeoAreaResponseDto[]> {
		return this.service.listActive();
	}
}

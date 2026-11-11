import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO runtime validation
import { AnalyzeTerrainDto } from "./dto/analyze-terrain.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { TerrainService } from "./terrain.service";

@ApiTags("route-safety")
@ApiBearerAuth()
@Controller("route-safety")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TerrainController {
	constructor(private readonly terrain: TerrainService) {}
	@Post("terrain")
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary: "Estimate terrain and moving time for a drawn route using MapTiler elevation",
	})
	@ApiResponse({
		status: 201,
		description: "Elevation profile or explicit unavailable status with distance-only estimate",
	})
	@ApiResponse({ status: 422, description: "Invalid or zero-length geometry" })
	analyze(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnalyzeTerrainDto) {
		return this.terrain.analyze(user.userId, dto.geometry);
	}
}

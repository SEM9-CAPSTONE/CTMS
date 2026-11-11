import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated DTO runtime metadata
import { AnalyzeRouteDto } from "./dto/analyze-route.dto";
// biome-ignore lint/style/useImportType: decorated DTO runtime metadata
import { ImportSafetyDto } from "./dto/import-safety.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { RouteSafetyService } from "./route-safety.service";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { SafetyImportService } from "./safety-import.service";

@ApiTags("route-safety")
@ApiBearerAuth()
@Controller("route-safety")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RouteSafetyController {
	constructor(
		private readonly safety: RouteSafetyService,
		private readonly imports: SafetyImportService
	) {}

	@Post("analyze")
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary:
			"Fetch current NCHMF warnings and analyze an owned or unsaved route; source availability is explicit",
	})
	@ApiResponse({
		status: 201,
		description:
			"Canonical GeoJSON, liveSource status and source timestamps, riskLevel (UNKNOWN when no active evidence), summary, analyzedAt, dataVersion, truncated and PARTIAL coverage",
	})
	@ApiResponse({ status: 403, description: "Host role and saved route ownership required" })
	@ApiResponse({ status: 422, description: "Invalid WGS84 LineString" })
	analyze(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnalyzeRouteDto) {
		return this.safety.analyze(user.userId, dto);
	}

	@Post("import")
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary:
			"Controlled import from an approved source; invalid records are quarantined independently",
	})
	@ApiResponse({ status: 201, description: "Counts of accepted, rejected and unchanged records" })
	@ApiResponse({ status: 403, description: "Source reuse not approved or actor is not Admin" })
	import(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportSafetyDto) {
		return this.imports.import(user.userId, dto);
	}
}

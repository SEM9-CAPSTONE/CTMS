import {
	Controller,
	Get,
	Header,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
	ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Runtime DTO validation metadata
import { RouteRecoveryQueryDto } from "./route-recovery-query.dto";
import { RouteRecoveryResponseDto } from "./route-recovery-response.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { RouteRecoveryService } from "./route-recovery.service";
import type { RouteRecoveryContext } from "./route-recovery.types";

@ApiTags("route-recovery")
@ApiBearerAuth()
@Controller("trips/:tripId/route-recovery")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER)
export class RouteRecoveryController {
	constructor(private readonly recovery: RouteRecoveryService) {}

	@Get("context")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary:
			"Validate an exact client-selected package for offline route recovery; no activation or Trip mutation",
	})
	@ApiResponse({
		status: 200,
		type: RouteRecoveryResponseDto,
		description:
			"AVAILABLE/STALE includes verified package geometry; UNAVAILABLE/MISMATCH has null geometry. See CTMS-315 contract.",
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Camper/Porter role required" })
	@ApiResponse({
		status: 404,
		description: "Trip missing or participation unavailable; same response",
	})
	@ApiResponse({
		status: 422,
		description: "Invalid trip UUID or missing/invalid package identity/version",
	})
	context(
		@CurrentUser() user: AuthenticatedUser,
		@Param("tripId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		tripId: string,
		@Query(
			new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
				errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
			})
		)
		query: RouteRecoveryQueryDto
	): Promise<RouteRecoveryContext> {
		return this.recovery.context(user.userId, tripId.toLowerCase(), query);
	}
}

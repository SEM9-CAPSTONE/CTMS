import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { MissedAlertsService } from "./missed-alerts.service";

@ApiTags("missed-alerts")
@ApiBearerAuth()
@Controller("missed-alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER)
export class MissedAlertsController {
	constructor(private readonly alerts: MissedAlertsService) {}

	@Get()
	list(@Req() request: { user: AuthenticatedUser }, @Query("cursor") cursor?: string) {
		return this.alerts.list(request.user.userId, cursor);
	}
}

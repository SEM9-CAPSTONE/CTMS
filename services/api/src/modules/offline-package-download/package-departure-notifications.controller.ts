import { Controller, Get, Header, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PackageDepartureNotificationsService } from "../offline-packages/package-departure-notifications.service";
import { UserRole } from "../users/entities/user.entity";

@ApiTags("offline-package-freshness")
@ApiBearerAuth()
@Controller("offline-package-notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.PORTER)
export class PackageDepartureNotificationsController {
	constructor(private readonly notifications: PackageDepartureNotificationsService) {}
	@Get()
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary:
			"Newest 50 durable departure-block notifications for the authenticated responsible user",
	})
	list(@CurrentUser() user: AuthenticatedUser) {
		return this.notifications.list(user.userId);
	}
	@Post(":id/read")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary: "Idempotently acknowledge an owned departure notification; does not override the gate",
	})
	read(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string
	) {
		return this.notifications.markRead(user.userId, id);
	}
}

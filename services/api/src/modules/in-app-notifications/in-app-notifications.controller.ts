import {
	Controller,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: ValidationPipe requires runtime DTO metadata
import { ListInAppNotificationsDto } from "./in-app-notifications.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { InAppNotificationsService } from "./in-app-notifications.service";

@ApiTags("in-app-notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("in-app-notifications")
export class InAppNotificationsController {
	constructor(private readonly notifications: InAppNotificationsService) {}

	@Get()
	@ApiOperation({ summary: "List the authenticated recipient's notifications" })
	list(@Req() req: { user: AuthenticatedUser }, @Query() query: ListInAppNotificationsDto) {
		return this.notifications.list(req.user.userId, query);
	}

	@Get("unread-count")
	@ApiOperation({ summary: "Count the authenticated recipient's unread notifications" })
	count(@Req() req: { user: AuthenticatedUser }) {
		return this.notifications.unreadCount(req.user.userId);
	}

	@Patch(":id/read")
	@HttpCode(204)
	@ApiOperation({ summary: "Mark an owned notification as read" })
	markRead(@Req() req: { user: AuthenticatedUser }, @Param("id", ParseUUIDPipe) id: string) {
		return this.notifications.markRead(req.user.userId, id);
	}
}

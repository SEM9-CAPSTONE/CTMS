import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: NestJS injection metadata
import { BookingCancellationNoticesService } from "./booking-cancellation-notices.service";

@ApiTags("booking-cancellation-notices")
@ApiBearerAuth()
@Controller("booking-cancellation-notices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class BookingCancellationNoticesController {
	constructor(private readonly notices: BookingCancellationNoticesService) {}

	@Get()
	@ApiOperation({
		summary: "List camper cancellations for the host's trips, or all trips for admins",
	})
	list(@Req() request: { user: AuthenticatedUser }) {
		return this.notices.list(request.user.userId);
	}

	@Patch(":noticeId/read")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Mark an owned cancellation notification as read" })
	markRead(
		@Req() request: { user: AuthenticatedUser },
		@Param("noticeId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		noticeId: string
	): Promise<void> {
		return this.notices.markRead(request.user.userId, noticeId);
	}
}

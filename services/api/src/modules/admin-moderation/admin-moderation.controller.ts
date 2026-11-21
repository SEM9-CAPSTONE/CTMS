import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { AdminModerationService } from "./admin-moderation.service";
import { AdminModerationCountsDto } from "./dto/admin-moderation-counts.dto";

@ApiTags("admin-moderation")
@ApiBearerAuth()
@Controller("admin/moderation")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminModerationController {
	constructor(private readonly moderation: AdminModerationService) {}

	@Get("counts")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "Count open items in the admin moderation queues" })
	@ApiOkResponse({ type: AdminModerationCountsDto })
	getCounts(): Promise<AdminModerationCountsDto> {
		return this.moderation.getCounts();
	}
}

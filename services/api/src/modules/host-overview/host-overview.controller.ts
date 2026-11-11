import {
	Controller,
	type ExecutionContext,
	Get,
	Header,
	Query,
	UseGuards,
	createParamDecorator,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO runtime validation metadata
import { HostOverviewQueryDto } from "./host-overview.dto";
import { HOST_OVERVIEW_SCHEMA } from "./host-overview.schema";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { HostOverviewService } from "./host-overview.service";
import type { HostOverview } from "./host-overview.types";

const CurrentOverviewHost = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser =>
		context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user
);

@ApiTags("host-overview")
@ApiBearerAuth()
@Controller("host/monitoring")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
export class HostOverviewController {
	constructor(private readonly overview: HostOverviewService) {}

	@Get("overview")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "Host operational overview (CTMS-377 / CTMS-087-T01)" })
	@ApiOkResponse({
		schema: HOST_OVERVIEW_SCHEMA,
		description:
			"Host-scoped read model; unavailable sources have null data/KPIs. Each source is paginated independently using page/limit.",
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active Host required" })
	@ApiResponse({ status: 422, description: "Invalid pagination" })
	getOverview(
		@CurrentOverviewHost() actor: AuthenticatedUser,
		@Query() query: HostOverviewQueryDto
	): Promise<HostOverview> {
		return this.overview.getOverview(actor, query);
	}
}

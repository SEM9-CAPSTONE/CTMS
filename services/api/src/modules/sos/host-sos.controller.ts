import { Controller, Get, HttpCode, HttpStatus, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO runtime metadata
import { GetHostSosQueryDto } from "./dto/get-host-sos-query.dto";
import { HostSosListResponseDto } from "./dto/host-sos-list-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection runtime metadata
import { SosService } from "./sos.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("sos")
@ApiBearerAuth()
@Controller("host/sos-alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Host role required" })
export class HostSosController {
	constructor(private readonly sosService: SosService) {}

	@Get()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			"List all SOS alerts across trips for the authenticated Host with filters and pagination",
	})
	@ApiResponse({
		status: 200,
		type: HostSosListResponseDto,
		description: "Paginated list of SOS alerts",
	})
	async listForHost(
		@Req() req: AuthenticatedRequest,
		@Query() query: GetHostSosQueryDto
	): Promise<HostSosListResponseDto> {
		return this.sosService.listForHost(req.user.userId, query);
	}
}

import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime
import { RouteIdParamDto } from "../trekking-routes/dto/route-id-param.dto";
import { UserRole } from "../users/entities/user.entity";
import type { DangerZoneProposalRow } from "./danger-zone-proposals.repository";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { DangerZoneProposalsService } from "./danger-zone-proposals.service";
import {
	// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime
	ApproveDangerZoneProposalDto,
	// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime
	CreateDangerZoneProposalDto,
	// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime
	ListDangerZoneProposalsQueryDto,
	// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime
	RejectDangerZoneProposalDto,
} from "./dto/danger-zone-proposals.dto";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const uuidPipe = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("danger-zone-proposals")
@ApiBearerAuth()
@Controller("trekking-routes/:routeId/danger-zone-proposals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Host role and route ownership required" })
@ApiResponse({ status: 404, description: "Trekking route not found" })
export class HostDangerZoneProposalsController {
	constructor(private readonly proposals: DangerZoneProposalsService) {}

	@Post()
	@ApiOperation({
		summary: "Propose a danger zone on an owned Route for Admin review",
		description:
			"Allowed in every Route status. Nothing is published until an Admin approves the proposal.",
	})
	@ApiResponse({ status: 422, description: "Invalid geometry, radius or hazard data" })
	create(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto,
		@Body() dto: CreateDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		return this.proposals.createForHost(request.user.userId, params.routeId, dto);
	}

	@Get()
	@ApiOperation({ summary: "Danger-zone proposals on an owned Route, newest first" })
	list(
		@Req() request: AuthenticatedRequest,
		@Param() params: RouteIdParamDto
	): Promise<DangerZoneProposalRow[]> {
		return this.proposals.listForHost(request.user.userId, params.routeId);
	}
}

@ApiTags("danger-zone-proposals")
@ApiBearerAuth()
@Controller("admin/danger-zone-proposals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class AdminDangerZoneProposalsController {
	constructor(private readonly proposals: DangerZoneProposalsService) {}

	@Get()
	@ApiOperation({ summary: "Danger-zone proposals from Hosts and field incidents, newest first" })
	list(@Query() query: ListDangerZoneProposalsQueryDto): Promise<DangerZoneProposalRow[]> {
		return this.proposals.listForAdmin(query.status);
	}

	@Get(":id")
	@ApiResponse({ status: 404, description: "Proposal not found" })
	getById(@Param("id", uuidPipe) id: string): Promise<DangerZoneProposalRow> {
		return this.proposals.getById(id);
	}

	@Post(":id/approve")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Approve a pending proposal and publish it as a verified danger zone",
	})
	@ApiResponse({ status: 404, description: "Proposal not found" })
	@ApiResponse({ status: 409, description: "Proposal already decided" })
	@ApiResponse({ status: 422, description: "Invalid approval data" })
	approve(
		@Req() request: AuthenticatedRequest,
		@Param("id", uuidPipe) id: string,
		@Body() dto: ApproveDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		return this.proposals.approve(request.user.userId, id, dto);
	}

	@Post(":id/reject")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Reject a pending proposal with a reason" })
	@ApiResponse({ status: 404, description: "Proposal not found" })
	@ApiResponse({ status: 409, description: "Proposal already decided" })
	reject(
		@Req() request: AuthenticatedRequest,
		@Param("id", uuidPipe) id: string,
		@Body() dto: RejectDangerZoneProposalDto
	): Promise<DangerZoneProposalRow> {
		return this.proposals.reject(request.user.userId, id, dto);
	}
}

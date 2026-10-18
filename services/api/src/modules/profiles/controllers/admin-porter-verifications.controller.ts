import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import {
	AdminPorterVerificationDetailDto,
	PaginatedPorterVerificationsResponseDto,
} from "../dto/admin-porter-verification.dto";
// biome-ignore lint/style/useImportType: @Query()/@Body() parameter types need runtime metadata for validation
import {
	ListPorterVerificationsQueryDto,
	RejectPorterVerificationDto,
} from "../dto/admin-porter-verification.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterVerificationsService } from "../services/porter-verifications.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const PORTER_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("admin-porter-verifications")
@ApiBearerAuth()
@Controller("admin/porter-verifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPorterVerificationsController {
	constructor(private readonly porterVerificationsService: PorterVerificationsService) {}

	@Get()
	@ApiOperation({ summary: "List Porter document verifications" })
	@ApiResponse({ status: 200, type: PaginatedPorterVerificationsResponseDto })
	@ApiResponse({ status: 403, description: "Admin access required" })
	list(
		@Query() query: ListPorterVerificationsQueryDto
	): Promise<PaginatedPorterVerificationsResponseDto> {
		return this.porterVerificationsService.listForAdmin(query);
	}

	@Get(":porterId")
	@ApiOperation({ summary: "View a Porter's verification documents" })
	@ApiResponse({ status: 200, type: AdminPorterVerificationDetailDto })
	@ApiResponse({ status: 404, description: "Porter not found" })
	getOne(
		@Param("porterId", PORTER_ID_PIPE) porterId: string
	): Promise<AdminPorterVerificationDetailDto> {
		return this.porterVerificationsService.getForAdmin(porterId);
	}

	@Patch(":porterId/approve")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Approve a Porter's guide certificate documents" })
	@ApiResponse({ status: 200, type: AdminPorterVerificationDetailDto })
	@ApiResponse({ status: 409, description: "Verification is not pending review" })
	approve(
		@Req() request: AuthenticatedRequest,
		@Param("porterId", PORTER_ID_PIPE) porterId: string
	): Promise<AdminPorterVerificationDetailDto> {
		return this.porterVerificationsService.approve(request.user.userId, porterId);
	}

	@Patch(":porterId/reject")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Reject a Porter's guide certificate documents with a reason" })
	@ApiResponse({ status: 200, type: AdminPorterVerificationDetailDto })
	@ApiResponse({ status: 409, description: "Verification is not pending review" })
	@ApiResponse({ status: 422, description: "Reason is required" })
	reject(
		@Req() request: AuthenticatedRequest,
		@Param("porterId", PORTER_ID_PIPE) porterId: string,
		@Body() dto: RejectPorterVerificationDto
	): Promise<AdminPorterVerificationDetailDto> {
		return this.porterVerificationsService.reject(request.user.userId, porterId, dto);
	}
}

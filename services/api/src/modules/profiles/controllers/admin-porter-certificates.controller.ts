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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: validation metadata
import {
	AdminRejectCertificateDto,
	PorterCertificateResponseDto,
} from "../dto/porter-certificate.dto";
import type { PorterCertificateStatus } from "../entities/porter-certificate.entity";
// biome-ignore lint/style/useImportType: NestJS DI injection
import { PorterCertificatesService } from "../services/porter-certificates.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("admin-porter-certificates")
@ApiBearerAuth()
@Controller("admin/porter-certificates")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPorterCertificatesController {
	constructor(private readonly porterCertificatesService: PorterCertificatesService) {}

	@Get()
	@ApiOperation({ summary: "Danh sách chứng chỉ Porter cần duyệt (Admin)" })
	@ApiQuery({
		name: "status",
		required: false,
		description: "Lọc theo trạng thái (pending, verified, rejected, expired)",
	})
	async list(@Query("status") status?: PorterCertificateStatus | "expired") {
		return this.porterCertificatesService.listForAdmin(status);
	}

	@Post(":id/verify")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Xác minh / Công nhận chứng chỉ hợp lệ" })
	@ApiResponse({ status: 200, type: PorterCertificateResponseDto })
	async verify(
		@Req() req: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<PorterCertificateResponseDto> {
		return this.porterCertificatesService.adminVerify(req.user.userId, id);
	}

	@Post(":id/reject")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Từ chối chứng chỉ kèm lý do" })
	@ApiResponse({ status: 200, type: PorterCertificateResponseDto })
	async reject(
		@Req() req: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: AdminRejectCertificateDto
	): Promise<PorterCertificateResponseDto> {
		return this.porterCertificatesService.adminReject(req.user.userId, id, dto);
	}
}

import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: used as @Body() DTO metadata at runtime
import { AcceptTermsDto } from "./dto/accept-terms.dto";
// biome-ignore lint/style/useImportType: used as @Body() DTO metadata at runtime
import { CreateTermsVersionDto, UpdateTermsVersionDto } from "./dto/admin-terms.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import {
	type AcceptTermsResponse,
	type MyTermsStatusResponse,
	TermsService,
	type TermsVersionDetailResponse,
	type TermsVersionSummaryResponse,
} from "./terms.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("terms")
@Controller("terms")
export class TermsController {
	constructor(private readonly termsService: TermsService) {}

	@Get("current")
	@ApiOperation({ summary: "Lấy phiên bản Điều khoản và Chính sách sử dụng hiện hành (công khai)" })
	@ApiResponse({ status: 200, description: "Nội dung phiên bản điều khoản đang hiệu lực" })
	@ApiResponse({ status: 404, description: "Chưa có phiên bản điều khoản đang hiệu lực" })
	getCurrent(): Promise<TermsVersionDetailResponse> {
		return this.termsService.getCurrentVersion();
	}

	@Get("versions")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Lấy danh sách lịch sử các phiên bản Điều khoản (chỉ Quản trị viên)" })
	@ApiResponse({ status: 200, description: "Danh sách phiên bản điều khoản" })
	listVersions(): Promise<TermsVersionSummaryResponse[]> {
		return this.termsService.listVersions();
	}

	@Get("versions/:version")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Lấy chi tiết toàn văn một phiên bản Điều khoản (chỉ Quản trị viên)" })
	@ApiResponse({ status: 200, description: "Chi tiết phiên bản điều khoản" })
	@ApiResponse({ status: 404, description: "Không tìm thấy phiên bản điều khoản" })
	getVersionByCode(@Param("version") version: string): Promise<TermsVersionDetailResponse> {
		return this.termsService.getVersionByCode(version);
	}

	@Get("my-status")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Kiểm tra trạng thái và lịch sử chấp thuận điều khoản của tài khoản" })
	@ApiResponse({ status: 200, description: "Trạng thái chấp thuận hiện tại" })
	@ApiResponse({ status: 401, description: "Yêu cầu đăng nhập" })
	getMyStatus(@Req() request: AuthenticatedRequest): Promise<MyTermsStatusResponse> {
		return this.termsService.getMyStatus(request.user.userId, request.user.roles);
	}

	@Post("accept")
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Xác nhận chấp thuận phiên bản điều khoản đang hiệu lực" })
	@ApiResponse({ status: 200, description: "Đã ghi nhận chấp thuận điều khoản" })
	@ApiResponse({ status: 401, description: "Yêu cầu đăng nhập" })
	@ApiResponse({ status: 409, description: "Phiên bản điều khoản đã thay đổi" })
	accept(
		@Req() request: AuthenticatedRequest,
		@Body() dto: AcceptTermsDto
	): Promise<AcceptTermsResponse> {
		return this.termsService.acceptTerms(request.user.userId, dto);
	}

	@Post("admin/versions")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Quản trị viên công bố phiên bản Điều khoản và Chính sách mới" })
	@ApiResponse({ status: 201, description: "Đã công bố phiên bản mới" })
	@ApiResponse({ status: 409, description: "Mã phiên bản đã tồn tại" })
	publishVersion(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateTermsVersionDto
	): Promise<TermsVersionDetailResponse> {
		return this.termsService.publishNewVersion(request.user.userId, dto);
	}

	@Patch("admin/versions/:id")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Quản trị viên chỉnh sửa nội dung phiên bản Điều khoản và Chính sách" })
	@ApiResponse({ status: 200, description: "Đã cập nhật phiên bản điều khoản" })
	@ApiResponse({ status: 404, description: "Không tìm thấy phiên bản" })
	updateVersion(
		@Req() request: AuthenticatedRequest,
		@Param("id") id: string,
		@Body() dto: UpdateTermsVersionDto
	): Promise<TermsVersionDetailResponse> {
		return this.termsService.updateVersion(request.user.userId, id, dto);
	}
}

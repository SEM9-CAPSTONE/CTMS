import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Req,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: NestJS DI injection
import { UploadsService } from "../../uploads/uploads.service";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: validation metadata
import {
	CreatePorterCertificateDto,
	PorterCertificateResponseDto,
	UpdatePorterCertificateDto,
} from "../dto/porter-certificate.dto";
// biome-ignore lint/style/useImportType: NestJS DI injection
import { PorterCertificatesService } from "../services/porter-certificates.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const MAX_CERTIFICATE_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

@ApiTags("porter-certificates")
@ApiBearerAuth()
@Controller("porter/certificates")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterCertificatesController {
	constructor(
		private readonly porterCertificatesService: PorterCertificatesService,
		private readonly uploadsService: UploadsService
	) {}

	@Get()
	@ApiOperation({ summary: "Lấy danh sách chứng chỉ của Porter hiện tại" })
	@ApiResponse({ status: 200, type: [PorterCertificateResponseDto] })
	async getMyCertificates(
		@Req() req: AuthenticatedRequest
	): Promise<PorterCertificateResponseDto[]> {
		return this.porterCertificatesService.getMyCertificates(req.user.userId);
	}

	@Get(":id")
	@ApiOperation({ summary: "Xem chi tiết một chứng chỉ" })
	@ApiResponse({ status: 200, type: PorterCertificateResponseDto })
	async getCertificate(
		@Req() req: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<PorterCertificateResponseDto> {
		return this.porterCertificatesService.getCertificateDetail(req.user.userId, false, id);
	}

	@Post()
	@ApiOperation({ summary: "Khai báo chứng chỉ mới" })
	@ApiResponse({ status: 201, type: PorterCertificateResponseDto })
	async create(
		@Req() req: AuthenticatedRequest,
		@Body() dto: CreatePorterCertificateDto
	): Promise<PorterCertificateResponseDto> {
		return this.porterCertificatesService.create(req.user.userId, dto);
	}

	@Put(":id")
	@ApiOperation({ summary: "Cập nhật chứng chỉ" })
	@ApiResponse({ status: 200, type: PorterCertificateResponseDto })
	async update(
		@Req() req: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: UpdatePorterCertificateDto
	): Promise<PorterCertificateResponseDto> {
		return this.porterCertificatesService.update(req.user.userId, id, dto);
	}

	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Xóa chứng chỉ (xóa mềm)" })
	async delete(
		@Req() req: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<{ success: boolean; message: string }> {
		return this.porterCertificatesService.delete(req.user.userId, id);
	}

	@Post("upload")
	@UseInterceptors(
		FileInterceptor("file", {
			limits: { fileSize: MAX_CERTIFICATE_FILE_BYTES },
			storage: memoryStorage(),
		})
	)
	@ApiOperation({ summary: "Tải lên ảnh/file chứng chỉ (tối đa 5MB, JPG/PNG/WebP/PDF)" })
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			properties: {
				file: { type: "string", format: "binary" },
			},
			required: ["file"],
		},
	})
	@ApiResponse({ status: 201, description: "Upload thành công, trả về fileUrl" })
	async uploadFile(@UploadedFile() file?: Express.Multer.File): Promise<{ fileUrl: string }> {
		if (!file) {
			throw new BadRequestException("Vui lòng chọn file chứng chỉ để tải lên");
		}

		if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
			throw new BadRequestException("Chỉ chấp nhận file ảnh JPG, PNG, WebP hoặc tài liệu PDF");
		}

		if (file.size > MAX_CERTIFICATE_FILE_BYTES) {
			throw new BadRequestException("Dung lượng file không được vượt quá 5MB");
		}

		const result = await this.uploadsService.uploadImage(file, "porter-certificates");
		return { fileUrl: result.url };
	}
}

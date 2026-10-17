import { Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UploadImageResponseDto } from "./dto/upload-image-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UploadsService } from "./uploads.service";

@ApiTags("uploads")
@ApiBearerAuth()
@Controller("uploads")
@UseGuards(JwtAuthGuard)
export class UploadsController {
	constructor(private readonly uploadsService: UploadsService) {}

	@Post("image")
	@UseInterceptors(
		FileInterceptor("file", {
			limits: { fileSize: 5 * 1024 * 1024 },
			storage: memoryStorage(),
		})
	)
	@ApiOperation({ summary: "Tải lên hình ảnh (Cloudinary hoặc Local Storage)" })
	@ApiConsumes("multipart/form-data")
	@ApiQuery({
		name: "folder",
		required: false,
		description: "Tên thư mục lưu trữ (mặc định: ctms)",
		example: "trips",
	})
	@ApiBody({
		schema: {
			type: "object",
			properties: {
				file: { type: "string", format: "binary" },
			},
			required: ["file"],
		},
	})
	@ApiResponse({
		status: 201,
		description: "Tải ảnh lên thành công",
		type: UploadImageResponseDto,
	})
	@ApiResponse({ status: 400, description: "File không hợp lệ hoặc vượt quá dung lượng cho phép" })
	@ApiResponse({ status: 401, description: "Yêu cầu đăng nhập" })
	uploadImage(
		@UploadedFile() file?: Express.Multer.File,
		@Query("folder") folder?: string
	): Promise<UploadImageResponseDto> {
		return this.uploadsService.uploadImage(file, folder);
	}
}

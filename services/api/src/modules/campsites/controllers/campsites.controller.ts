import { mkdirSync } from "node:fs";
import { extname } from "node:path";
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
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
import { diskStorage } from "multer";
import {
	CAMPSITE_PENDING_UPLOAD_PUBLIC_PATH,
	getCampsitePendingUploadDir,
} from "../../../shared/uploads/upload-paths";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { CampsiteMediaUploadResponseDto } from "../dto/campsite-media-upload-response.dto";
import { CampsiteResponseDto } from "../dto/campsite-response.dto";
import { PaginatedCampsiteSearchResponseDto } from "../dto/campsite-search-result.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { CreateCampsiteDto } from "../dto/create-campsite.dto";
// biome-ignore lint/style/useImportType: used as a @Query() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { UpdateCampsiteDto } from "../dto/update-campsite.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesService } from "../services/campsites.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function ensureCampsitePendingUploadDir(): void {
	mkdirSync(getCampsitePendingUploadDir(), { recursive: true });
}

function buildUploadFileName(file: Express.Multer.File): string {
	const extension = extname(file.originalname).toLowerCase() || ".jpg";
	const safeSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

	return `campsite-${safeSuffix}${extension}`;
}

@ApiTags("campsites")
@ApiBearerAuth()
@Controller("campsites")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampsitesController {
	constructor(private readonly campsitesService: CampsitesService) {}

	@Post("media")
	@Roles(UserRole.HOST)
	@UseInterceptors(
		FileInterceptor("file", {
			limits: { fileSize: 5 * 1024 * 1024 },
			fileFilter: (_request, file, callback) => {
				if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
					callback(new BadRequestException("Only JPG, PNG, or WebP images are allowed"), false);
					return;
				}

				callback(null, true);
			},
			storage: diskStorage({
				destination: (_request, _file, callback) => {
					ensureCampsitePendingUploadDir();
					callback(null, getCampsitePendingUploadDir());
				},
				filename: (_request, file, callback) => {
					callback(null, buildUploadFileName(file));
				},
			}),
		})
	)
	@ApiOperation({ summary: "Upload a campsite media file" })
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
	@ApiResponse({ status: 201, type: CampsiteMediaUploadResponseDto })
	@ApiResponse({ status: 400, description: "Invalid upload file" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host access required" })
	uploadMedia(@UploadedFile() file?: Express.Multer.File): CampsiteMediaUploadResponseDto {
		if (!file) {
			throw new BadRequestException("Image file is required");
		}

		const baseUrl =
			process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? "3000"}`;

		return {
			url: `${baseUrl}${CAMPSITE_PENDING_UPLOAD_PUBLIC_PATH}${file.filename}`,
		};
	}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a campsite pending admin approval" })
	@ApiResponse({
		status: 201,
		description: "Created campsite pending admin approval",
		type: CampsiteResponseDto,
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host access required" })
	@ApiResponse({ status: 422, description: "Invalid campsite payload" })
	create(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateCampsiteDto
	): Promise<CampsiteResponseDto> {
		return this.campsitesService.create(request.user.userId, dto);
	}

	@Get("my")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List campsites owned by the authenticated Host" })
	@ApiResponse({
		status: 200,
		description: "Host campsites",
		type: [CampsiteResponseDto],
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host access required" })
	listMine(@Req() request: AuthenticatedRequest): Promise<CampsiteResponseDto[]> {
		return this.campsitesService.listMine(request.user.userId);
	}

	@Patch(":id")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Edit a campsite owned by the authenticated Host" })
	@ApiResponse({
		status: 200,
		description: "Updated campsite information",
		type: CampsiteResponseDto,
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host ownership required" })
	@ApiResponse({ status: 404, description: "Campsite not found" })
	@ApiResponse({ status: 409, description: "Campsite changed since the supplied version" })
	@ApiResponse({ status: 422, description: "Invalid campsite payload" })
	update(
		@Req() request: AuthenticatedRequest,
		@Param("id", new ParseUUIDPipe()) id: string,
		@Body() dto: UpdateCampsiteDto
	): Promise<CampsiteResponseDto> {
		return this.campsitesService.update(request.user.userId, id, dto);
	}

	@Get()
	@Roles(UserRole.CAMPER)
	@ApiOperation({
		summary: "Search active campsites by province, amenities, and zone base price range",
	})
	@ApiResponse({
		status: 200,
		description: "Search results",
		type: PaginatedCampsiteSearchResponseDto,
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Camper access required" })
	@ApiResponse({ status: 422, description: "Invalid query" })
	search(@Query() query: SearchCampsitesQueryDto): Promise<PaginatedCampsiteSearchResponseDto> {
		return this.campsitesService.search(query);
	}
}

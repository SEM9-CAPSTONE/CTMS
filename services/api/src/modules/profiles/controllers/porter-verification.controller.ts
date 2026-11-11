import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
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
import { UserRole } from "../../users/entities/user.entity";
import {
	PorterVerificationDocumentDto,
	PorterVerificationResponseDto,
} from "../dto/porter-verification-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterVerificationsService } from "../services/porter-verifications.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

export const PORTER_VERIFICATION_MAX_FILE_BYTES = 5 * 1024 * 1024;

const DOCUMENT_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("porter-verification")
@ApiBearerAuth()
@Controller("porter/verification")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterVerificationController {
	constructor(private readonly porterVerificationsService: PorterVerificationsService) {}

	@Get()
	@ApiOperation({ summary: "Get the authenticated Porter's document verification status" })
	@ApiResponse({ status: 200, type: PorterVerificationResponseDto })
	getMine(@Req() request: AuthenticatedRequest): Promise<PorterVerificationResponseDto> {
		return this.porterVerificationsService.getMine(request.user.userId);
	}

	@Post("documents")
	@UseInterceptors(
		FileInterceptor("file", {
			limits: { fileSize: PORTER_VERIFICATION_MAX_FILE_BYTES, files: 1 },
			storage: memoryStorage(),
		})
	)
	@ApiOperation({ summary: "Upload a guide certificate document (JPG, PNG, WEBP or PDF, max 5MB)" })
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			properties: { file: { type: "string", format: "binary" } },
			required: ["file"],
		},
	})
	@ApiResponse({ status: 201, type: PorterVerificationDocumentDto })
	@ApiResponse({ status: 400, description: "Missing, invalid or oversized file" })
	@ApiResponse({ status: 409, description: "Documents locked or document limit reached" })
	uploadDocument(
		@Req() request: AuthenticatedRequest,
		@UploadedFile() file?: Express.Multer.File
	): Promise<PorterVerificationDocumentDto> {
		return this.porterVerificationsService.uploadDocument(request.user.userId, file);
	}

	@Delete("documents/:documentId")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Remove an uploaded document before submitting" })
	@ApiResponse({ status: 204, description: "Document removed" })
	@ApiResponse({ status: 404, description: "Document not found" })
	@ApiResponse({ status: 409, description: "Documents locked" })
	deleteDocument(
		@Req() request: AuthenticatedRequest,
		@Param("documentId", DOCUMENT_ID_PIPE) documentId: string
	): Promise<void> {
		return this.porterVerificationsService.deleteDocument(request.user.userId, documentId);
	}

	@Post("submit")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Submit uploaded documents for Admin review" })
	@ApiResponse({ status: 200, type: PorterVerificationResponseDto })
	@ApiResponse({ status: 409, description: "Verification is not in a submittable status" })
	@ApiResponse({ status: 422, description: "No document uploaded" })
	submit(@Req() request: AuthenticatedRequest): Promise<PorterVerificationResponseDto> {
		return this.porterVerificationsService.submit(request.user.userId);
	}
}

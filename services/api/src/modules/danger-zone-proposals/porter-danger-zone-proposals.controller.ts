import {
	Body,
	Controller,
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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { PROPOSAL_PHOTO_MAX_BYTES } from "./danger-zone-proposals.constants";
// biome-ignore lint/style/useImportType: ValidationPipe runtime DTO
import { PorterDangerZoneProposalDto } from "./dto/porter-danger-zone-proposal.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection
import {
	PorterDangerZoneProposalsService,
	type ProposalPhotoUpload,
} from "./porter-danger-zone-proposals.service";

/** Multer stops reading an oversize photo and answers 413 before it reaches the service. */
const PHOTO_UPLOAD_INTERCEPTOR = FileInterceptor("file", {
	storage: memoryStorage(),
	limits: { files: 1, fileSize: PROPOSAL_PHOTO_MAX_BYTES },
});

@ApiTags("danger-zone-proposals")
@ApiBearerAuth()
@Controller("trips/:tripId/danger-zone-proposals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterDangerZoneProposalsController {
	constructor(private readonly proposals: PorterDangerZoneProposalsService) {}
	@Post()
	create(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ParseUUIDPipe) tripId: string,
		@Body() dto: PorterDangerZoneProposalDto
	) {
		return this.proposals.create(request.user.userId, tripId, dto);
	}
	@Post(":proposalId/photos")
	@HttpCode(HttpStatus.OK)
	@UseInterceptors(PHOTO_UPLOAD_INTERCEPTOR)
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			required: ["file"],
			properties: { file: { type: "string", format: "binary" } },
		},
	})
	@ApiOperation({
		summary: "Attach one field photo (JPEG/PNG/WebP, max 5 MB, max 3) to an own pending report",
	})
	addPhoto(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ParseUUIDPipe) tripId: string,
		@Param("proposalId", ParseUUIDPipe) proposalId: string,
		@UploadedFile() file: ProposalPhotoUpload | undefined
	) {
		return this.proposals.addPhoto(request.user.userId, tripId, proposalId, file);
	}
	@Get()
	list(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ParseUUIDPipe) tripId: string
	) {
		return this.proposals.list(request.user.userId, tripId);
	}
}

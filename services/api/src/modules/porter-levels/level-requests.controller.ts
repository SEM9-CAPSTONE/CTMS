import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	StreamableFile,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { LevelNotificationsService } from "./level-notifications.service";
import { LEVEL_EVIDENCE_MAX_COUNT, LEVEL_EVIDENCE_MAX_SIZE } from "./level-request-files.service";
// biome-ignore lint/style/useImportType: DTO validation metadata
import {
	ApproveLevelRequestDto,
	CreateLevelRequestDto,
	ListLevelRequestsDto,
	RequestVersionDto,
	ResubmitLevelRequestDto,
	ReviewLevelRequestDto,
} from "./level-requests.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { LevelRequestsService } from "./level-requests.service";
import { LevelRequestStatus } from "./level-requests.types";
interface ActorRequest {
	user: AuthenticatedUser;
}
const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 422 });
const upload = FilesInterceptor("files", LEVEL_EVIDENCE_MAX_COUNT, {
	limits: { fileSize: LEVEL_EVIDENCE_MAX_SIZE, files: LEVEL_EVIDENCE_MAX_COUNT },
});

@ApiTags("porter-level-requests")
@ApiBearerAuth()
@Controller("porter/level-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterLevelRequestsController {
	constructor(private readonly requests: LevelRequestsService) {}
	@Get()
	@ApiOperation({ summary: "List only the current Porter's level requests" })
	list(@Req() req: ActorRequest, @Query() dto: ListLevelRequestsDto) {
		return this.requests.list(req.user.userId, false, dto);
	}
	@Post()
	@UseInterceptors(upload)
	@ApiConsumes("multipart/form-data")
	@ApiOperation({ summary: "Request a higher Route level with optional private evidence files" })
	create(
		@Req() req: ActorRequest,
		@Body() dto: CreateLevelRequestDto,
		@UploadedFiles() files: Express.Multer.File[]
	) {
		return this.requests.create(req.user.userId, dto, files ?? []);
	}
	@Get(":id")
	@ApiOperation({ summary: "Read own request and its immutable event timeline" })
	detail(@Req() req: ActorRequest, @Param("id", uuid) id: string) {
		return this.requests.detail(req.user.userId, false, id);
	}
	@Post(":id/cancel")
	@ApiOperation({ summary: "Cancel own pending or needs-info request" })
	cancel(@Req() req: ActorRequest, @Param("id", uuid) id: string, @Body() dto: RequestVersionDto) {
		return this.requests.cancel(req.user.userId, id, dto.expectedVersion);
	}
	@Post(":id/resubmit")
	@ApiOperation({ summary: "Resubmit changed evidence or reason from needs-info" })
	resubmit(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Body() dto: ResubmitLevelRequestDto
	) {
		return this.requests.resubmit(req.user.userId, id, dto);
	}
	@Post(":id/evidence")
	@UseInterceptors(upload)
	@ApiConsumes("multipart/form-data")
	@ApiOperation({ summary: "Add evidence only while own request needs information" })
	evidence(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Body() dto: RequestVersionDto,
		@UploadedFiles() files: Express.Multer.File[]
	) {
		return this.requests.addEvidence(req.user.userId, id, dto.expectedVersion, files ?? []);
	}
	@Delete(":id/evidence/:evidenceId")
	@ApiOperation({ summary: "Soft-remove evidence without deleting its retained file" })
	remove(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Param("evidenceId", uuid) evidenceId: string,
		@Body() dto: RequestVersionDto
	) {
		return this.requests.removeEvidence(req.user.userId, id, evidenceId, dto.expectedVersion);
	}
	@Get(":id/evidence/:evidenceId")
	@ApiOperation({ summary: "Download a private file belonging to own request" })
	async file(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Param("evidenceId", uuid) evidenceId: string
	) {
		const { file, buffer } = await this.requests.download(req.user.userId, false, id, evidenceId);
		return new StreamableFile(buffer, {
			type: file.mimeType,
			disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
		});
	}
}

@ApiTags("porter-level-requests")
@ApiBearerAuth()
@Controller("admin/porter-level-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLevelRequestsController {
	constructor(private readonly requests: LevelRequestsService) {}
	@Get()
	@ApiOperation({ summary: "Admin request queue filtered by status, Route or Porter" })
	list(@Req() req: ActorRequest, @Query() dto: ListLevelRequestsDto) {
		return this.requests.list(req.user.userId, true, dto);
	}
	@Get(":id")
	@ApiOperation({ summary: "Compare Porter dossier and target criteria without automatic grading" })
	detail(@Req() req: ActorRequest, @Param("id", uuid) id: string) {
		return this.requests.detail(req.user.userId, true, id);
	}
	@Post(":id/approve")
	@ApiOperation({ summary: "Approve exactly the requested level using fresh review versions" })
	approve(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Body() dto: ApproveLevelRequestDto
	) {
		return this.requests.approve(req.user.userId, id, dto);
	}
	@Post(":id/reject")
	@ApiOperation({ summary: "Reject pending or needs-info request with mandatory reason" })
	reject(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Body() dto: ReviewLevelRequestDto
	) {
		return this.requests.review(req.user.userId, id, LevelRequestStatus.REJECTED, dto);
	}
	@Post(":id/request-info")
	@ApiOperation({ summary: "Request additional evidence with mandatory reason" })
	info(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Body() dto: ReviewLevelRequestDto
	) {
		return this.requests.review(req.user.userId, id, LevelRequestStatus.NEEDS_INFO, dto);
	}
	@Get(":id/evidence/:evidenceId")
	@ApiOperation({ summary: "Admin download of retained private request evidence" })
	async file(
		@Req() req: ActorRequest,
		@Param("id", uuid) id: string,
		@Param("evidenceId", uuid) evidenceId: string
	) {
		const { file, buffer } = await this.requests.download(req.user.userId, true, id, evidenceId);
		return new StreamableFile(buffer, {
			type: file.mimeType,
			disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
		});
	}
}

@ApiTags("porter-level-requests")
@ApiBearerAuth()
@Controller("porter/level-notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterLevelNotificationsController {
	constructor(private readonly notifications: LevelNotificationsService) {}
	@Get()
	@ApiOperation({ summary: "Read durable in-app notifications for the current Porter" })
	list(@Req() req: ActorRequest) {
		return this.notifications.list(req.user.userId);
	}
	@Post(":id/read")
	@ApiOperation({ summary: "Mark own notification as read" })
	read(@Req() req: ActorRequest, @Param("id", uuid) id: string) {
		return this.notifications.read(req.user.userId, id);
	}
}

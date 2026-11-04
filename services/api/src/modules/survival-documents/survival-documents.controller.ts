import {
	Body,
	Controller,
	Get,
	Header,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	StreamableFile,
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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: runtime DTO validation metadata
import {
	EditSourceDto,
	ListSourcesDto,
	ReviewSourceDto,
	RevisionDto,
	UploadSourceDto,
} from "./dto/source.dto";
import catalog from "./official-sources.json";
import { sourceMaxBytes } from "./source-files.service";
// biome-ignore lint/style/useImportType: Nest injection
import { SurvivalDocumentsService } from "./survival-documents.service";

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 422 });
const upload = FileInterceptor("file");
const multipart = {
	schema: {
		type: "object",
		required: ["file", "metadata"],
		properties: {
			file: { type: "string", format: "binary" },
			metadata: { type: "string", description: "JSON SourceMetadataDto" },
			expectedDocumentRevision: { type: "integer" },
		},
	},
};
@ApiTags("admin-survival-documents")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin required" })
@ApiResponse({ status: 409, description: "Stale revision or illegal transition" })
@ApiResponse({ status: 413, description: "Upload too large" })
@ApiResponse({ status: 422, description: "Invalid metadata, rights or PDF" })
@Controller("admin/survival-documents")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SurvivalDocumentsController {
	constructor(private readonly documents: SurvivalDocumentsService) {}
	@Get("references")
	@ApiOperation({
		summary: "Read link-only, unreviewed reference catalog; never fetches external content",
	})
	references() {
		return { items: catalog.items, maxBytes: sourceMaxBytes() };
	}
	@Get()
	@ApiOperation({ summary: "List source documents by latest version metadata and status" })
	list(@Query() query: ListSourcesDto) {
		return this.documents.list(query);
	}
	@Get(":id")
	@ApiOperation({ summary: "Read exact-version history, provenance and audit" })
	detail(@Param("id", uuid) id: string) {
		return this.documents.detail(id);
	}
	@Get(":id/versions")
	@ApiOperation({ summary: "Read complete immutable version history" })
	async versions(@Param("id", uuid) id: string) {
		return (await this.documents.detail(id)).versions;
	}
	@Post()
	@ApiOperation({ summary: "Upload private PDF and create unreviewed draft v1" })
	@ApiConsumes("multipart/form-data")
	@ApiBody(multipart)
	@UseInterceptors(upload)
	create(
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: UploadSourceDto,
		@UploadedFile() file?: Express.Multer.File
	) {
		return this.documents.upload(actor.userId, dto, file);
	}
	@Post(":id/versions")
	@ApiOperation({ summary: "Upload a new draft with document revision protection" })
	@ApiConsumes("multipart/form-data")
	@ApiBody(multipart)
	@UseInterceptors(upload)
	newVersion(
		@Param("id", uuid) id: string,
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: UploadSourceDto,
		@UploadedFile() file?: Express.Multer.File
	) {
		return this.documents.upload(actor.userId, dto, file, id);
	}
	@Get(":id/versions/:versionId/file")
	@ApiOperation({ summary: "Download private original; Admin authentication required" })
	@Header("Cache-Control", "private, no-store")
	@Header("X-Content-Type-Options", "nosniff")
	@Header("Content-Security-Policy", "sandbox; default-src 'none'")
	async file(@Param("id", uuid) id: string, @Param("versionId", uuid) versionId: string) {
		const file = await this.documents.file(id, versionId);
		return new StreamableFile(file.bytes, {
			type: "application/pdf",
			disposition: `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
			length: file.bytes.length,
		});
	}
	@Patch(":id/versions/:versionId/metadata")
	@ApiOperation({ summary: "Edit draft-only provenance" })
	metadata(
		@Param("id", uuid) id: string,
		@Param("versionId", uuid) versionId: string,
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: EditSourceDto
	) {
		return this.documents.change(actor.userId, id, versionId, "metadata", dto);
	}
	@Post(":id/versions/:versionId/submit")
	@ApiOperation({ summary: "Submit draft to source and rights review" })
	submit(
		@Param("id", uuid) id: string,
		@Param("versionId", uuid) versionId: string,
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: RevisionDto
	) {
		return this.documents.change(actor.userId, id, versionId, "submit", dto);
	}
	@Post(":id/versions/:versionId/review")
	@ApiOperation({
		summary: "Record exact-work source, licensing and medical review; approve or reject",
	})
	review(
		@Param("id", uuid) id: string,
		@Param("versionId", uuid) versionId: string,
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: ReviewSourceDto
	) {
		return this.documents.change(actor.userId, id, versionId, "review", dto);
	}
	@Post(":id/versions/:versionId/publish")
	@ApiOperation({ summary: "Atomically publish approved source and queue regeneration context" })
	publish(
		@Param("id", uuid) id: string,
		@Param("versionId", uuid) versionId: string,
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: RevisionDto
	) {
		return this.documents.change(actor.userId, id, versionId, "publish", dto);
	}
	@Post(":id/versions/:versionId/archive")
	@ApiOperation({ summary: "Stop use of current publication without deleting provenance" })
	archive(
		@Param("id", uuid) id: string,
		@Param("versionId", uuid) versionId: string,
		@CurrentUser() actor: AuthenticatedUser,
		@Body() dto: RevisionDto
	) {
		return this.documents.change(actor.userId, id, versionId, "archive", dto);
	}
}

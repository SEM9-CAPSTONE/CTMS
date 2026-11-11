import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { KnowledgeChunksService } from "./knowledge-chunks.service";

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 422 });
@ApiTags("admin-knowledge-chunks")
@ApiBearerAuth()
@Controller("admin/survival-documents/:documentId/versions/:versionId/chunk-sets")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class KnowledgeChunksController {
	constructor(private readonly service: KnowledgeChunksService) {}
	@Get()
	@ApiOperation({ summary: "Inspect exact-version ingestion status and quality issues" })
	status(
		@Param("documentId", uuid) documentId: string,
		@Param("versionId", uuid) versionId: string
	) {
		return this.service.status(documentId, versionId);
	}
	@Post()
	@HttpCode(202)
	@ApiOperation({ summary: "Enqueue or retry eligible source ingestion idempotently" })
	enqueue(
		@Param("documentId", uuid) documentId: string,
		@Param("versionId", uuid) versionId: string
	) {
		return this.service.enqueue(documentId, versionId);
	}
}

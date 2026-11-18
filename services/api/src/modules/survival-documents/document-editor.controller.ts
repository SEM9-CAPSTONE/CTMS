import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { DocumentEditorService } from "./document-editor.service";
// biome-ignore lint/style/useImportType: runtime DTO validation metadata
import {
	ConfirmDocumentEditDto,
	PlanDocumentEditDto,
	StartDocumentEditDto,
} from "./dto/document-editor.dto";

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 422 });

@Controller("admin/survival-documents/:id")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DocumentEditorController {
	constructor(private readonly editor: DocumentEditorService) {}

	@Post("edit-drafts")
	begin(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", uuid) id: string,
		@Body() dto: StartDocumentEditDto
	) {
		return this.editor.begin(actor.userId, id, dto.expectedDocumentRevision);
	}

	@Get("versions/:versionId/editor-content")
	historical(@Param("id", uuid) id: string, @Param("versionId", uuid) versionId: string) {
		return this.editor.historical(id, versionId);
	}

	@Get("edit-drafts/:draftId/preview")
	preview(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", uuid) id: string,
		@Param("draftId", uuid) draftId: string
	) {
		return this.editor.preview(actor.userId, id, draftId);
	}

	@Post("edit-drafts/:draftId/plan")
	plan(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", uuid) id: string,
		@Param("draftId", uuid) draftId: string,
		@Body() dto: PlanDocumentEditDto
	) {
		return this.editor.plan(actor.userId, id, draftId, dto);
	}

	@Patch("edit-drafts/:draftId")
	confirm(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", uuid) id: string,
		@Param("draftId", uuid) draftId: string,
		@Body() dto: ConfirmDocumentEditDto
	) {
		return this.editor.confirm(actor.userId, id, draftId, dto);
	}
}

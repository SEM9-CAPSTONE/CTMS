import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: DTO validation
import { VerifyContentDto } from "./content-verification.dto";
// biome-ignore lint/style/useImportType: Nest injection
import { ContentVerificationService } from "./content-verification.service";

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 422 });
@Controller("admin/survival-documents/:documentId/versions/:versionId/content-verification")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ContentVerificationController {
	constructor(private readonly service: ContentVerificationService) {}
	@Get()
	inspect(
		@Param("documentId", uuid) documentId: string,
		@Param("versionId", uuid) versionId: string
	) {
		return this.service.inspect(documentId, versionId);
	}
	@Post(":regionId")
	verify(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("documentId", uuid) documentId: string,
		@Param("versionId", uuid) versionId: string,
		@Param("regionId") regionId: string,
		@Body() dto: VerifyContentDto
	) {
		return this.service.verify(actor.userId, documentId, versionId, regionId, dto);
	}
}

import {
	Body,
	Controller,
	Get,
	Header,
	HttpException,
	HttpStatus,
	Inject,
	Logger,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
	ServiceUnavailableException,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { AiInvestigationAdminService } from "./ai-investigation-admin.service";
import { Review } from "./ai-investigation.types";

export class ListAiInvestigationsQuery {
	@IsOptional() @IsIn(["ALL", "UNSAFE"]) scope?: "ALL" | "UNSAFE";
	@IsOptional() @IsIn(Object.values(Review)) reviewStatus?: Review;
	@IsOptional() @IsUUID("4") groupId?: string;
	@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
	@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

const caseId = new ParseUUIDPipe({
	version: "4",
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("ai-investigations")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/ai-investigations")
export class AiInvestigationController {
	private readonly logger = new Logger(AiInvestigationController.name);

	constructor(
		@Inject(AiInvestigationAdminService) private readonly service: AiInvestigationAdminService
	) {}

	@Get()
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "List investigation cases or the Unsafe review queue" })
	list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListAiInvestigationsQuery) {
		return this.respond(this.service.list(actor, query));
	}

	@Get(":id")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Read the authorized investigation report and review history" })
	detail(@CurrentUser() actor: AuthenticatedUser, @Param("id", caseId) id: string) {
		return this.respond(this.service.detail(actor, id));
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Start Unsafe review, record technical handoff or record substantiated resolution",
	})
	update(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", caseId) id: string,
		@Body() body: unknown
	) {
		return this.respond(this.service.update(actor, id, body));
	}

	private async respond<T>(operation: Promise<T>): Promise<T> {
		try {
			return await operation;
		} catch (error) {
			if (error instanceof HttpException) throw error;
			this.logger.warn("AI_INVESTIGATION_DATA_UNAVAILABLE");
			throw new ServiceUnavailableException({ code: "AI_INVESTIGATION_UNAVAILABLE" });
		}
	}
}

import {
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { MAX_QUERY_LENGTH } from "../rag/rag.types";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { AiAnswersService } from "./ai-answers.service";

class AskSurvivalQuestionDto {
	@IsUUID("4")
	requestId!: string;

	@IsString()
	@MaxLength(MAX_QUERY_LENGTH)
	question!: string;

	@IsString()
	@Matches(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
	locale!: string;
}

@ApiTags("AI Answers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER)
@Controller("ai/answers")
export class AiAnswersController {
	constructor(private readonly service: AiAnswersService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Ask an online first-aid or survival question" })
	ask(@CurrentUser() actor: AuthenticatedUser, @Body() body: AskSurvivalQuestionDto) {
		return this.service.ask(actor, body);
	}

	@Get(":answerId/sources")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Read source metadata recorded for an owned answer" })
	sources(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("answerId", ParseUUIDPipe) answerId: string
	) {
		return this.service.sources(actor, answerId);
	}
}

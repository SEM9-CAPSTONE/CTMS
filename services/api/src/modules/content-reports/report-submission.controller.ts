import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: Nest validation metadata
import { CreateContentReportDto } from "./dto/create-content-report.dto";
// biome-ignore lint/style/useImportType: Nest validation metadata
import { ListContentReportsQueryDto } from "./dto/list-content-reports-query.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { ReportSubmissionService } from "./report-submission.service";
import { SubmittedReport } from "./report-submission.types";

@ApiTags("My content reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("me/content-reports")
export class ReportSubmissionController {
	constructor(private readonly reports: ReportSubmissionService) {}

	@Post()
	@HttpCode(200)
	@ApiOperation({ summary: "Submit a report or replay the same submission" })
	@ApiOkResponse({ type: SubmittedReport })
	create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateContentReportDto) {
		return this.reports.create(actor.userId, dto);
	}

	@Get()
	@ApiOperation({ summary: "List only my submitted reports" })
	list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListContentReportsQueryDto) {
		return this.reports.listOwn(actor.userId, query);
	}

	@Get(":reportId")
	@ApiOperation({ summary: "Read my report without exposing moderation internals" })
	@ApiOkResponse({ type: SubmittedReport })
	get(@CurrentUser() actor: AuthenticatedUser, @Param("reportId", ParseUUIDPipe) id: string) {
		return this.reports.getOwn(actor.userId, id);
	}
}

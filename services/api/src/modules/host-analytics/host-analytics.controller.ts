import {
	Body,
	Controller,
	Get,
	Header,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Res,
	UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

interface HttpResponseLike {
	status(code: number): unknown;
	setHeader(name: string, value: string): unknown;
}
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: ValidationPipe requires runtime class metadata
import { CreateHostSuggestionJobDto } from "./dto/create-host-suggestion-job.dto";
// biome-ignore lint/style/useImportType: ValidationPipe requires runtime class metadata
import { GetHostAnalyticsQueryDto } from "./dto/get-host-analytics-query.dto";
import type {
	HostAnalyticsResponseDto,
	HostSuggestionJobResponseDto,
	QuickCreateContextResponseDto,
} from "./dto/host-analytics-response.dto";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import {
	HostAnalyticsRateLimitException,
	HostAnalyticsSuggestionsService,
} from "./host-analytics-suggestions.service";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { HostAnalyticsService } from "./host-analytics.service";

@Controller("host/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
export class HostAnalyticsController {
	constructor(
		private readonly hostAnalyticsService: HostAnalyticsService,
		private readonly suggestionsService: HostAnalyticsSuggestionsService
	) {}

	@Get()
	@Header("Cache-Control", "no-store")
	async getHostAnalytics(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: GetHostAnalyticsQueryDto
	): Promise<HostAnalyticsResponseDto> {
		return this.hostAnalyticsService.getHostAnalytics(user, query);
	}

	@Post("suggestions")
	@Header("Cache-Control", "no-store")
	async createSuggestionJob(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: CreateHostSuggestionJobDto,
		@Res({ passthrough: true }) res: HttpResponseLike
	): Promise<HostSuggestionJobResponseDto> {
		try {
			const { httpStatus, job } = await this.suggestionsService.createJob(user, body);
			res.status(httpStatus);
			return job;
		} catch (error) {
			if (error instanceof HostAnalyticsRateLimitException) {
				res.setHeader("Retry-After", String(error.retryAfterSeconds));
			}
			throw error;
		}
	}

	@Get("suggestions/latest")
	@Header("Cache-Control", "no-store")
	async getLatestSuggestionJob(
		@CurrentUser() user: AuthenticatedUser
	): Promise<HostSuggestionJobResponseDto> {
		return this.suggestionsService.getLatestJob(user);
	}

	@Get("suggestions/:id")
	@Header("Cache-Control", "no-store")
	async getSuggestionJobById(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<HostSuggestionJobResponseDto> {
		return this.suggestionsService.getJobById(user, id);
	}

	@Get("suggestions/:id/quick-create-context")
	@Header("Cache-Control", "no-store")
	async getQuickCreateContext(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<QuickCreateContextResponseDto> {
		return this.suggestionsService.getQuickCreateContext(user, id);
	}
}

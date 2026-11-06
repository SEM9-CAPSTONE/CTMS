import {
	Body,
	Controller,
	Get,
	HttpException,
	Param,
	Post,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: DTO runtime validation
import { EmptyAnalysisRequestDto } from "../review-analysis/review-analysis.dto";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { DemandInsightsService } from "./demand-insights.service";
interface DemandResponse {
	setHeader(name: string, value: string): void;
	status(code: number): unknown;
}
@ApiTags("demand-insights")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
@Controller("host/demand-insights")
export class DemandInsightsController {
	constructor(private readonly service: DemandInsightsService) {}
	@Post(":month")
	@ApiOperation({ summary: "Request or reuse a shared closed-month booking demand report" })
	async create(
		@Req() req: { user: AuthenticatedUser },
		@Param("month") month: string,
		@Body() _body: EmptyAnalysisRequestDto,
		@Res({ passthrough: true }) response: DemandResponse
	) {
		response.setHeader("Cache-Control", "no-store");
		try {
			const result = await this.service.create(req.user.userId, month);
			response.status(result.status === "pending" || result.status === "running" ? 202 : 200);
			return result;
		} catch (error) {
			if (error instanceof HttpException && error.getStatus() === 429) {
				const body = error.getResponse();
				if (
					body &&
					typeof body === "object" &&
					"retryAfterSeconds" in body &&
					typeof body.retryAfterSeconds === "number"
				)
					response.setHeader("Retry-After", String(body.retryAfterSeconds));
			}
			throw error;
		}
	}
	@Get(":month")
	@ApiOperation({ summary: "Read a privacy-gated shared market report without source identities" })
	read(
		@Req() req: { user: AuthenticatedUser },
		@Param("month") month: string,
		@Res({ passthrough: true }) response: DemandResponse
	) {
		response.setHeader("Cache-Control", "no-store");
		return this.service.read(req.user.userId, month);
	}
}

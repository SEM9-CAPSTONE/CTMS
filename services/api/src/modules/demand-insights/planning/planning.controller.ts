import {
	Body,
	Controller,
	Get,
	HttpException,
	Param,
	Post,
	Put,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: runtime DTO validation
import { EmptyAnalysisRequestDto } from "../../review-analysis/review-analysis.dto";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { PlanningCatalog } from "./planning.catalog";
// biome-ignore lint/style/useImportType: Nest injection
import { PlanningService } from "./planning.service";
export class TripDemandContextDto {
	@ApiProperty({ format: "uuid" }) @IsUUID() tripId!: string;
	@ApiProperty({ maxLength: 40 })
	@IsString()
	@MaxLength(40)
	@Matches(/^[a-z0-9][a-z0-9-]{1,39}$/)
	areaCode!: string;
}
interface ResponseContext {
	setHeader(name: string, value: string): void;
	status(code: number): unknown;
}
@ApiTags("demand-planning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
@Controller("host/demand-insights")
export class PlanningController {
	constructor(
		private readonly service: PlanningService,
		private readonly catalog: PlanningCatalog
	) {}
	@Get("areas")
	@ApiOperation({ summary: "List approved active planning areas" })
	areas(@Req() req: { user: AuthenticatedUser }, @Res({ passthrough: true }) res: ResponseContext) {
		res.setHeader("Cache-Control", "no-store");
		return this.catalog.areas(req.user.userId);
	}
	@Put("trip-context")
	@ApiOperation({
		summary: "Confirm an owned Trip's catalog area for future analytic snapshots only",
	})
	confirm(
		@Req() req: { user: AuthenticatedUser },
		@Body() dto: TripDemandContextDto,
		@Res({ passthrough: true }) res: ResponseContext
	) {
		res.setHeader("Cache-Control", "no-store");
		return this.catalog.confirm(req.user.userId, dto.tripId, dto.areaCode);
	}

	@Get(":month/planning-suggestions")
	@ApiOperation({ summary: "Read persisted grounded planning suggestions without calling AI" })
	read(
		@Req() req: { user: AuthenticatedUser },
		@Param("month") month: string,
		@Res({ passthrough: true }) res: ResponseContext
	) {
		res.setHeader("Cache-Control", "no-store");
		return this.service.read(req.user.userId, month);
	}
	@Post(":month/planning-suggestions")
	@ApiOperation({ summary: "Request one shared planning job from a frozen monthly context" })
	async create(
		@Req() req: { user: AuthenticatedUser },
		@Param("month") month: string,
		@Body() _body: EmptyAnalysisRequestDto,
		@Res({ passthrough: true }) res: ResponseContext
	) {
		res.setHeader("Cache-Control", "no-store");
		try {
			const result = await this.service.create(req.user.userId, month);
			res.status(["pending", "running"].includes(result.status) ? 202 : 200);
			return result;
		} catch (error) {
			if (error instanceof HttpException && error.getStatus() === 429) {
				const body = error.getResponse();
				if (body && typeof body === "object" && "retryAfterSeconds" in body)
					res.setHeader("Retry-After", String(body.retryAfterSeconds));
			}
			throw error;
		}
	}
}

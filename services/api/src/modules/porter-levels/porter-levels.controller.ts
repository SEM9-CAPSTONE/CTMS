import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: request DTO validation metadata
import {
	DecidePorterLevelDto,
	LevelComparisonParamDto,
	LevelParamDto,
	ListLevelQualificationsDto,
	SaveLevelEvidenceDto,
	SaveLevelPolicyDto,
} from "./porter-levels.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PorterLevelsService } from "./porter-levels.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}
const UUID = new ParseUUIDPipe({ errorHttpStatusCode: 422 });

@ApiTags("porter-levels")
@ApiBearerAuth()
@Controller("admin/porter-levels")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPorterLevelsController {
	constructor(private readonly levels: PorterLevelsService) {}

	@Get("policies")
	@ApiOperation({ summary: "List explicitly configured Porter level criteria; no default rules" })
	policies() {
		return this.levels.policies();
	}

	@Put("policies/:level")
	@ApiOperation({ summary: "Configure criteria for one of the three existing Porter levels" })
	savePolicy(
		@Req() req: AuthenticatedRequest,
		@Param() params: LevelParamDto,
		@Body() dto: SaveLevelPolicyDto
	) {
		return this.levels.savePolicy(req.user.userId, params.level, dto);
	}

	@Get("qualifications")
	@ApiOperation({ summary: "List Route-specific qualification claims for manual review" })
	list(@Query() dto: ListLevelQualificationsDto) {
		return this.levels.list(dto.page, dto.limit);
	}

	@Get("qualifications/:id/comparison/:level")
	@ApiOperation({
		summary: "Compare a locked profile snapshot with target level criteria; never changes level",
	})
	comparison(@Param() params: LevelComparisonParamDto) {
		return this.levels.comparison(params.id, params.level);
	}

	@Post("qualifications/:id/decisions")
	@ApiOperation({
		summary: "Record an Admin's manual approve/reject decision with immutable evidence",
	})
	decide(
		@Req() req: AuthenticatedRequest,
		@Param("id", UUID) id: string,
		@Body() dto: DecidePorterLevelDto
	) {
		return this.levels.decide(req.user.userId, id, dto);
	}

	@Get("qualifications/:id/history")
	@ApiOperation({
		summary: "Read review history including the criteria and evidence used at decision time",
	})
	history(@Param("id", UUID) id: string) {
		return this.levels.history(id);
	}
}

@ApiTags("porter-levels")
@ApiBearerAuth()
@Controller("porter/level-review")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterLevelReviewController {
	constructor(private readonly levels: PorterLevelsService) {}

	@Get("policies")
	@ApiOperation({ summary: "Read the Admin-defined level criteria" })
	policies() {
		return this.levels.policies();
	}

	@Get("skills")
	@ApiOperation({ summary: "Read the authenticated Porter's declared skills" })
	evidence(@Req() req: AuthenticatedRequest) {
		return this.levels.evidence(req.user.userId);
	}
	@Get("qualifications")
	@ApiOperation({ summary: "List own Route qualifications and the currently open request, if any" })
	qualifications(@Req() req: AuthenticatedRequest) {
		return this.levels.mine(req.user.userId);
	}

	@Put("skills")
	@ApiOperation({ summary: "Update declared skills without changing any approved level" })
	saveEvidence(@Req() req: AuthenticatedRequest, @Body() dto: SaveLevelEvidenceDto) {
		return this.levels.saveEvidence(req.user.userId, dto);
	}

	@Get("history")
	@ApiOperation({ summary: "Read only the authenticated Porter's manual level review history" })
	history(@Req() req: AuthenticatedRequest) {
		return this.levels.ownHistory(req.user.userId);
	}
}

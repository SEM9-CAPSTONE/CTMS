import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the body
import { ReviewSafetyHotspotDto } from "./dto/review-safety-hotspot.dto";
// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the query
import { ListSafetyHotspotsQueryDto } from "./dto/safety-hotspots.dto";
// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the body
import { UpdateSafetyHotspotDto } from "./dto/update-safety-hotspot.dto";
import type { CorrectiveActionRow } from "./hotspot-corrective-actions.repository";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { HotspotCorrectiveActionsService } from "./hotspot-corrective-actions.service";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { HotspotDetailsService } from "./hotspot-details.service";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { type HotspotReviewRow, HotspotReviewService } from "./hotspot-review.service";
import type { HotspotEvidenceEvent, SafetyHotspotRow } from "./safety-hotspots.repository";
// biome-ignore lint/style/useImportType: Nest runtime DI metadata
import { type HotspotDetectionResult, SafetyHotspotsService } from "./safety-hotspots.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

/**
 * CTMS-116: potential safety hotspots for authorized safety review (Admin). Candidates carry
 * aggregate counts, a cluster centre and evidence ids only (BR-361); review is CTMS-117.
 */
@ApiTags("safety-hotspots")
@ApiBearerAuth()
@Controller("admin/safety-hotspots")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 403, description: "Admin role required" })
export class SafetyHotspotsController {
	constructor(
		private readonly hotspots: SafetyHotspotsService,
		private readonly correctiveActions: HotspotCorrectiveActionsService,
		private readonly reviews: HotspotReviewService,
		private readonly details: HotspotDetailsService
	) {}

	@Post(":id/review")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary:
			"Confirm or dismiss a detected hotspot directly, including existing under-review records",
		description:
			"Human Admin decision with a reason (BR-357, BR-424). Review never changes Route safety data.",
	})
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	@ApiResponse({ status: 409, description: "Transition not allowed from the current status" })
	async review(
		@Req() request: AuthenticatedRequest,
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string,
		@Body() dto: ReviewSafetyHotspotDto
	): Promise<SafetyHotspotRow> {
		await this.reviews.review(request.user.userId, id, dto);
		return this.hotspots.getById(id);
	}

	@Get(":id/reviews")
	@ApiOperation({ summary: "Review decisions on a hotspot, newest first" })
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	async listReviews(
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string
	): Promise<HotspotReviewRow[]> {
		await this.hotspots.getById(id);
		return this.reviews.list(id);
	}

	@Post("detect")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Run hotspot detection now over the last 30 days of authoritative deviation events",
		description:
			"Creates UNDER_REVIEW candidates for same-Route clusters within 50 m having at least 3 distinct Trips, 3 distinct Members and 5 RouteDeviationEvents (BR-417, BR-418). Idempotent; never changes Route or safety data (BR-356).",
	})
	detect(@Req() request: AuthenticatedRequest): Promise<HotspotDetectionResult> {
		return this.hotspots.detect(request.user.userId);
	}

	@Get()
	@ApiOperation({ summary: "List potential safety hotspots, newest first" })
	list(@Query() query: ListSafetyHotspotsQueryDto): Promise<SafetyHotspotRow[]> {
		return this.hotspots.list(query);
	}

	@Get(":id")
	@ApiOperation({ summary: "One potential safety hotspot with its evidence context" })
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	getById(
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string
	): Promise<SafetyHotspotRow> {
		return this.hotspots.getById(id);
	}

	@Get(":id/evidence")
	@ApiOperation({
		summary: "Deviation events behind the hotspot: Trip and time of each, no member data (BR-361)",
	})
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	evidence(
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string
	): Promise<HotspotEvidenceEvent[]> {
		return this.hotspots.evidence(id);
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Edit the Admin-written name, description and severity of a hotspot",
		description: "Position, radius and evidence stay as detected. Audited.",
	})
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	@ApiResponse({ status: 422, description: "Invalid name, description or severity" })
	async update(
		@Req() request: AuthenticatedRequest,
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string,
		@Body() dto: UpdateSafetyHotspotDto
	): Promise<SafetyHotspotRow> {
		await this.details.update(request.user.userId, id, dto);
		return this.hotspots.getById(id);
	}

	@Delete(":id")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: "Permanently delete a hotspot and its review history",
		description:
			"Refused with 409 when the hotspot already changed Route safety data. A later detection may find the place again from its evidence. Audited.",
	})
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	@ApiResponse({ status: 409, description: "Hotspot already changed Route safety data" })
	async remove(
		@Req() request: AuthenticatedRequest,
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string
	): Promise<void> {
		await this.details.remove(request.user.userId, id);
	}

	@Get(":id/corrective-actions")
	@ApiOperation({ summary: "Corrective actions already taken from this hotspot, newest first" })
	@ApiResponse({ status: 404, description: "Hotspot not found" })
	async listCorrectiveActions(
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		id: string
	): Promise<CorrectiveActionRow[]> {
		await this.hotspots.getById(id);
		return this.correctiveActions.listByHotspot(id);
	}
}

import {
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
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
// biome-ignore lint/style/useImportType: ValidationPipe needs the DTO class at runtime to validate the query
import { ListSafetyHotspotsQueryDto } from "./dto/safety-hotspots.dto";
import type { SafetyHotspotRow } from "./safety-hotspots.repository";
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
	constructor(private readonly hotspots: SafetyHotspotsService) {}

	@Post("detect")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Run hotspot detection now over the last 30 days of authoritative deviation events",
		description:
			"Creates DETECTED candidates for same-Route clusters within 50 m having at least 3 distinct Trips, 3 distinct Members and 5 RouteDeviationEvents (BR-417, BR-418). Idempotent; never changes Route or safety data (BR-356).",
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
}

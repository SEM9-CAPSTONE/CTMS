import {
	Body,
	Controller,
	Get,
	Header,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
	ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PackageActivationService } from "../offline-packages/package-activation.service";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: ValidationPipe runtime metadata
import { PackageDeviceQueryDto, PackageDeviceReportDto } from "./package-freshness.dto";

const validation = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	errorHttpStatusCode: 422,
});
const tripIdPipe = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });
@ApiTags("offline-package-freshness")
@ApiBearerAuth()
@Controller("trips/:tripId/offline-package-policy")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER)
@ApiResponse({ status: 404, description: "Trip absent or participation unavailable" })
@ApiResponse({ status: 409, description: "Stable package policy reason code" })
export class PackageFreshnessController {
	constructor(private readonly policy: PackageActivationService) {}
	@Get("departure-status")
	@Header("Cache-Control", "private, no-store")
	@Roles(UserRole.HOST, UserRole.CAMPER, UserRole.PORTER)
	@ApiOperation({
		summary:
			"Read departure blocking status without requiring any downloaded package or device; participants and owning Host only",
	})
	departureStatus(
		@CurrentUser() user: AuthenticatedUser,
		@Param("tripId", tripIdPipe) tripId: string
	) {
		return this.policy.departureStatus(user.userId, tripId);
	}
	@Get("context")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary:
			"Read independent integrity/publication/source-freshness axes for an exact local package",
	})
	context(
		@CurrentUser() user: AuthenticatedUser,
		@Param("tripId", tripIdPipe) tripId: string,
		@Query(validation) query: PackageDeviceQueryDto
	) {
		return this.policy.context(user.userId, tripId, query.deviceId, query.packageId);
	}
	@Post("device-report")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "Report client download/hash/activation; does not attest device bytes" })
	report(
		@CurrentUser() user: AuthenticatedUser,
		@Param("tripId", tripIdPipe) tripId: string,
		@Body(validation) body: PackageDeviceReportDto
	) {
		return this.policy.report(user.userId, tripId, body);
	}
	@Post("departure-ready")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary: "Assigned Porter confirms the one device to check at scheduled departure",
	})
	ready(
		@CurrentUser() user: AuthenticatedUser,
		@Param("tripId", tripIdPipe) tripId: string,
		@Body(validation) body: PackageDeviceQueryDto
	) {
		return this.policy.confirmDeparture(user.userId, tripId, { ...body, status: "active" });
	}
}

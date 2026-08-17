import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
	Post,
	Put,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import {
	HealthProfileResponseDto,
	toHealthProfileResponse,
} from "../dto/health-profile-response.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UpdateHealthProfileDto } from "../dto/update-health-profile.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { CamperHealthProfileService } from "../services/camper-health-profile.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("health-profile")
@ApiBearerAuth()
@Controller("camper/health-profile")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CamperHealthProfileController {
	constructor(private readonly camperHealthProfileService: CamperHealthProfileService) {}

	@Get()
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Get the authenticated camper's health profile" })
	@ApiResponse({ status: 200, type: HealthProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active account required" })
	async getMyProfile(@Req() req: AuthenticatedRequest): Promise<HealthProfileResponseDto> {
		const profile = await this.camperHealthProfileService.getOrCreateProfile(req.user.userId);
		return toHealthProfileResponse(profile);
	}

	@Put()
	@Roles(UserRole.CAMPER)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Update the authenticated camper's health profile" })
	@ApiResponse({ status: 200, type: HealthProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active account required" })
	@ApiResponse({ status: 409, description: "Conflict - Stale version" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	async updateMyProfile(
		@Req() req: AuthenticatedRequest,
		@Body() dto: UpdateHealthProfileDto,
		@Query("version", ParseIntPipe) version: number
	): Promise<HealthProfileResponseDto> {
		const profile = await this.camperHealthProfileService.updateProfile(
			req.user.userId,
			dto,
			version
		);
		return toHealthProfileResponse(profile);
	}

	@Post("consent/grant")
	@Roles(UserRole.CAMPER)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Grant health profile sharing consent to relevant Hosts and Porters" })
	@ApiResponse({ status: 200, type: HealthProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active account required" })
	async grantConsent(@Req() req: AuthenticatedRequest): Promise<HealthProfileResponseDto> {
		const profile = await this.camperHealthProfileService.grantConsent(req.user.userId);
		return toHealthProfileResponse(profile);
	}

	@Post("consent/revoke")
	@Roles(UserRole.CAMPER)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Revoke health profile sharing consent" })
	@ApiResponse({ status: 200, type: HealthProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active account required" })
	async revokeConsent(@Req() req: AuthenticatedRequest): Promise<HealthProfileResponseDto> {
		const profile = await this.camperHealthProfileService.revokeConsent(req.user.userId);
		return toHealthProfileResponse(profile);
	}

	@Get(":userId")
	@Roles(UserRole.CAMPER, UserRole.HOST, UserRole.PORTER, UserRole.ADMIN)
	@ApiOperation({ summary: "Retrieve another camper's health profile if authorized and consented" })
	@ApiResponse({ status: 200, type: HealthProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Access denied or account inactive" })
	@ApiResponse({ status: 404, description: "Camper or health profile not found" })
	async getCamperProfile(
		@Req() req: AuthenticatedRequest,
		@Param("userId") camperId: string
	): Promise<HealthProfileResponseDto> {
		const { profile, activeTripTitle } = await this.camperHealthProfileService.getCamperProfile(
			req.user.userId,
			camperId
		);
		return toHealthProfileResponse(profile, activeTripTitle);
	}
}

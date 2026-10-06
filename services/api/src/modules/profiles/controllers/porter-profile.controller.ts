import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { PorterProfileResponseDto } from "../dto/porter-profile-response.dto";
// biome-ignore lint/style/useImportType: decorated request DTO needs runtime metadata
import { UpdatePorterProfileDto } from "../dto/update-porter-profile.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterProfilesService } from "../services/porter-profiles.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("porter-profile")
@ApiBearerAuth()
@Controller("porter/profile")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PORTER)
export class PorterProfileController {
	constructor(private readonly porterProfilesService: PorterProfilesService) {}

	@Get()
	@ApiOperation({ summary: "Get the authenticated Porter's professional profile" })
	@ApiResponse({ status: 200, type: PorterProfileResponseDto })
	getMyProfile(@Req() request: AuthenticatedRequest): Promise<PorterProfileResponseDto> {
		return this.porterProfilesService.getMyProfile(request.user.userId);
	}

	@Patch()
	@ApiOperation({ summary: "Create or update the authenticated Porter's professional profile" })
	@ApiResponse({ status: 200, type: PorterProfileResponseDto })
	updateMyProfile(
		@Req() request: AuthenticatedRequest,
		@Body() dto: UpdatePorterProfileDto
	): Promise<PorterProfileResponseDto> {
		return this.porterProfilesService.updateMyProfile(request.user.userId, dto);
	}
}

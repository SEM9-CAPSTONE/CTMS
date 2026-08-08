import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { ProfileResponseDto } from "./dto/profile-response.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { UpdateProfileDto } from "./dto/update-profile.dto";
import type { ProfilesService } from "./profiles.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("profiles")
@ApiBearerAuth()
@Controller("profiles")
@UseGuards(JwtAuthGuard)
export class ProfilesController {
	constructor(private readonly profilesService: ProfilesService) {}

	@Get("me")
	@ApiOperation({ summary: "Get the authenticated user's personal profile" })
	@ApiResponse({ status: 200, description: "Profile retrieved", type: ProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active account required" })
	getMe(@Req() request: AuthenticatedRequest): Promise<ProfileResponseDto> {
		return this.profilesService.getMyProfile(request.user.userId);
	}

	@Patch("me")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Update personal profile and emergency contacts" })
	@ApiResponse({ status: 200, description: "Profile updated", type: ProfileResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Active account required" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	updateMe(
		@Req() request: AuthenticatedRequest,
		@Body() dto: UpdateProfileDto
	): Promise<ProfileResponseDto> {
		return this.profilesService.updateMyProfile(request.user.userId, dto);
	}
}

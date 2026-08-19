import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { CampsiteResponseDto } from "../dto/campsite-response.dto";
import { PaginatedCampsiteSearchResponseDto } from "../dto/campsite-search-result.dto";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { CreateCampsiteDto } from "../dto/create-campsite.dto";
// biome-ignore lint/style/useImportType: used as a @Query() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesService } from "../services/campsites.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

/**
 * CTMS-17-T01 (CTMS-77). Actor is Camper (frozen per Jira, overriding the
 * spec doc's "As a Host" wording -- see Step 8). Guard scope was raised as
 * an open Decision Gate (BR-046/047/048 don't specify auth/role) and
 * explicitly resolved: JwtAuthGuard + Roles(CAMPER) only.
 */
@ApiTags("campsites")
@ApiBearerAuth()
@Controller("campsites")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampsitesController {
	constructor(private readonly campsitesService: CampsitesService) {}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a campsite draft" })
	@ApiResponse({
		status: 201,
		description: "Created campsite draft",
		type: CampsiteResponseDto,
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host access required" })
	@ApiResponse({ status: 422, description: "Invalid campsite payload" })
	create(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateCampsiteDto
	): Promise<CampsiteResponseDto> {
		return this.campsitesService.create(request.user.userId, dto);
	}

	@Get()
	@Roles(UserRole.CAMPER)
	@ApiOperation({
		summary: "Search active campsites by province/city, amenities, and zone base price range",
	})
	@ApiResponse({
		status: 200,
		description: "Search results",
		type: PaginatedCampsiteSearchResponseDto,
	})
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Camper access required" })
	@ApiResponse({ status: 422, description: "Invalid query" })
	search(@Query() query: SearchCampsitesQueryDto): Promise<PaginatedCampsiteSearchResponseDto> {
		return this.campsitesService.search(query);
	}
}

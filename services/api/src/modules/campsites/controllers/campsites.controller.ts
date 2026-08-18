import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { UserRole } from "../../users/entities/user.entity";
import { PaginatedCampsiteSearchResponseDto } from "../dto/campsite-search-result.dto";
// biome-ignore lint/style/useImportType: used as a @Query() parameter type, needs design:paramtypes metadata for NestJS's validation/transform pipeline
import { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { CampsitesService } from "../services/campsites.service";

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
@Roles(UserRole.CAMPER)
export class CampsitesController {
	constructor(private readonly campsitesService: CampsitesService) {}

	@Get()
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

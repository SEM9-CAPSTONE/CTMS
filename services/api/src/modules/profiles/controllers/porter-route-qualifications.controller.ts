import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Put,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated parameter DTOs need runtime metadata
import {
	PorterQualificationIdParamDto,
	PorterRouteIdParamDto,
} from "../dto/porter-qualification-param.dto";
import { PorterRouteQualificationResponseDto } from "../dto/porter-route-qualification-response.dto";
// biome-ignore lint/style/useImportType: decorated request DTO needs runtime metadata
import { UpsertPorterRouteQualificationDto } from "../dto/upsert-porter-route-qualification.dto";
// biome-ignore lint/style/useImportType: decorated request DTO needs runtime metadata
import { VerifyPorterRouteQualificationDto } from "../dto/verify-porter-route-qualification.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterRouteQualificationsService } from "../services/porter-route-qualifications.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("porter-route-qualifications")
@ApiBearerAuth()
@Controller("porter/route-qualifications")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PorterRouteQualificationsController {
	constructor(private readonly qualificationsService: PorterRouteQualificationsService) {}

	@Get()
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "List the authenticated Porter's Route qualifications" })
	@ApiResponse({ status: 200, type: PorterRouteQualificationResponseDto, isArray: true })
	listMine(@Req() request: AuthenticatedRequest): Promise<PorterRouteQualificationResponseDto[]> {
		return this.qualificationsService.listMine(request.user.userId);
	}

	@Put(":routeId")
	@HttpCode(HttpStatus.OK)
	@Roles(UserRole.PORTER)
	@ApiOperation({ summary: "Create or update the Porter's claim for a Route" })
	@ApiResponse({ status: 200, type: PorterRouteQualificationResponseDto })
	upsertMine(
		@Req() request: AuthenticatedRequest,
		@Param() params: PorterRouteIdParamDto,
		@Body() dto: UpsertPorterRouteQualificationDto
	): Promise<PorterRouteQualificationResponseDto> {
		return this.qualificationsService.upsertMine(request.user.userId, params.routeId, dto);
	}

	@Patch(":qualificationId/verify")
	@Roles(UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Verify the current Porter Route qualification claim" })
	@ApiResponse({ status: 200, type: PorterRouteQualificationResponseDto })
	verify(
		@Req() request: AuthenticatedRequest,
		@Param() params: PorterQualificationIdParamDto,
		@Body() dto: VerifyPorterRouteQualificationDto
	): Promise<PorterRouteQualificationResponseDto> {
		return this.qualificationsService.verify(request.user, params.qualificationId, dto);
	}
}

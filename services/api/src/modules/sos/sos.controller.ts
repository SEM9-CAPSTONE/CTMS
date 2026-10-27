import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Swagger and class-validator runtime metadata
import { CancelSosDto } from "./dto/cancel-sos.dto";
// biome-ignore lint/style/useImportType: Swagger and class-validator runtime metadata
import { CreateSosDto } from "./dto/create-sos.dto";
import { SosAlertResponseDto } from "./dto/sos-alert-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection runtime metadata
import { SosService } from "./sos.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("sos")
@ApiBearerAuth()
@Controller("trips/:tripId/sos")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiResponse({ status: 401, description: "Authentication required" })
export class SosController {
	constructor(private readonly sosService: SosService) {}

	@Post()
	@Roles(UserRole.CAMPER)
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Create an emergency SOS alert for a trip (CTMS-074)" })
	@ApiParam({ name: "tripId", description: "Trip UUID" })
	@ApiResponse({ status: 201, type: SosAlertResponseDto, description: "SOS alert created" })
	@ApiResponse({ status: 403, description: "Not a participant of this trip" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 422, description: "Validation failure" })
	async create(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Body() dto: CreateSosDto
	): Promise<SosAlertResponseDto> {
		return this.sosService.createSos(req.user.userId, tripId, dto);
	}

	@Patch(":sosId/cancel")
	@Roles(UserRole.CAMPER)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Cancel an accidental SOS alert (CTMS-077, BR-258)" })
	@ApiParam({ name: "tripId", description: "Trip UUID" })
	@ApiParam({ name: "sosId", description: "SOS Alert UUID" })
	@ApiResponse({ status: 200, type: SosAlertResponseDto, description: "SOS alert cancelled" })
	@ApiResponse({ status: 403, description: "Not the sender who created the SOS alert" })
	@ApiResponse({ status: 404, description: "SOS alert or Trip not found" })
	@ApiResponse({
		status: 409,
		description: "Conflict: SOS is not active, already cancelled, acknowledged, or closed",
	})
	@ApiResponse({ status: 422, description: "Validation failure or invalid UUID" })
	async cancel(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Param("sosId", UUID_PIPE) sosId: string,
		@Body() dto: CancelSosDto
	): Promise<SosAlertResponseDto> {
		return this.sosService.cancel(req.user.userId, tripId, sosId, dto);
	}

	@Get()
	@Roles(UserRole.CAMPER, UserRole.PORTER, UserRole.HOST)
	@ApiOperation({ summary: "List all SOS alerts for a trip" })
	@ApiParam({ name: "tripId", description: "Trip UUID" })
	@ApiResponse({
		status: 200,
		type: [SosAlertResponseDto],
		description: "List of SOS alerts for the trip",
	})
	async list(
		@Req() req: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string
	): Promise<SosAlertResponseDto[]> {
		return this.sosService.listForTrip(req.user.userId, tripId);
	}
}

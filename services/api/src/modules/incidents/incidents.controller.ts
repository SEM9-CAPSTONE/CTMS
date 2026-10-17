import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Req,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import {
	IncidentListResponseDto,
	IncidentResponseDto,
	ReportIncidentResponseDto,
} from "./dto/incident-response.dto";
// biome-ignore lint/style/useImportType: Body validation needs runtime DTO metadata
import { ReportIncidentDto } from "./dto/report-incident.dto";
import { INCIDENT_MEDIA_MAX_BYTES } from "./incidents.constants";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { type IncidentMediaUpload, IncidentsService } from "./incidents.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

/** Multer stops reading an oversize upload and answers 413 before it reaches the service. */
const MEDIA_UPLOAD_INTERCEPTOR = FileInterceptor("file", {
	storage: memoryStorage(),
	limits: { files: 1, fileSize: INCIDENT_MEDIA_MAX_BYTES },
});

@ApiTags("incidents")
@ApiBearerAuth()
@Controller("trips/:tripId/incidents")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiResponse({ status: 401, description: "Authentication required" })
@ApiResponse({ status: 404, description: "Trip or incident not found" })
export class IncidentsController {
	constructor(private readonly incidents: IncidentsService) {}

	@Post()
	@Roles(UserRole.PORTER)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Report (or re-synchronize) a Trip incident; a repeated id returns the stored one",
	})
	@ApiResponse({ status: 200, type: ReportIncidentResponseDto })
	@ApiResponse({ status: 403, description: "Caller is not a Porter assigned to the Trip" })
	@ApiResponse({
		status: 409,
		description:
			"Trip not in progress, incident time outside the Trip, or id used by another report",
	})
	@ApiResponse({ status: 422, description: "Invalid incident fields" })
	report(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Body() dto: ReportIncidentDto
	): Promise<ReportIncidentResponseDto> {
		return this.incidents.reportIncident(request.user.userId, tripId, dto);
	}

	@Get()
	@Roles(UserRole.PORTER, UserRole.HOST)
	@ApiOperation({
		summary: "List Trip incidents: all for the Trip's Host, own reports for an assigned Porter",
	})
	@ApiResponse({ status: 200, type: IncidentListResponseDto })
	@ApiResponse({ status: 403, description: "Not the Trip's Host or an assigned Porter" })
	list(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string
	): Promise<IncidentListResponseDto> {
		return this.incidents.listIncidents(request.user.userId, request.user.roles, tripId);
	}

	@Put(":incidentId/media")
	@Roles(UserRole.PORTER)
	@UseInterceptors(MEDIA_UPLOAD_INTERCEPTOR)
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			required: ["file"],
			properties: { file: { type: "string", format: "binary" } },
		},
	})
	@ApiOperation({
		summary: "Attach the optional photo to a stored incident; retries keep the first photo",
	})
	@ApiResponse({ status: 200, type: IncidentResponseDto })
	@ApiResponse({ status: 403, description: "Caller did not report this incident" })
	@ApiResponse({ status: 413, description: "Upload exceeds the size limit" })
	@ApiResponse({ status: 422, description: "Missing file or not a JPEG/PNG/WebP image" })
	attachMedia(
		@Req() request: AuthenticatedRequest,
		@Param("tripId", UUID_PIPE) tripId: string,
		@Param("incidentId", UUID_PIPE) incidentId: string,
		@UploadedFile() file: IncidentMediaUpload | undefined
	): Promise<IncidentResponseDto> {
		return this.incidents.attachMedia(request.user.userId, tripId, incidentId, file);
	}
}

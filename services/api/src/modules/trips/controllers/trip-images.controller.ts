import {
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { MAX_TRIP_IMAGE_BYTES, TripImagesService } from "../services/trip-images.service";
// biome-ignore lint/style/useImportType: Nest injection
import { TripsService } from "../services/trips.service";

@ApiTags("trips")
@Controller("trips/:tripId/images")
export class TripImagesController {
	constructor(
		private readonly images: TripImagesService,
		private readonly trips: TripsService
	) {}
	@Get()
	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: "List visible Trip images in upload order (public for published trips)",
	})
	async list(
		@Req() req: { user?: AuthenticatedUser },
		@Param("tripId", ParseUUIDPipe) tripId: string
	) {
		await this.trips.getTripDetails(req.user, tripId);
		return this.images.list(tripId);
	}
	@Post()
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Upload a Trip image; identical content is idempotent" })
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			required: ["file"],
			properties: { file: { type: "string", format: "binary" } },
		},
	})
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: MAX_TRIP_IMAGE_BYTES, files: 1 } })
	)
	add(
		@Req() req: { user: AuthenticatedUser },
		@Param("tripId", ParseUUIDPipe) tripId: string,
		@UploadedFile() file?: Express.Multer.File
	) {
		return this.images.add(req.user.userId, tripId, file);
	}
	@Delete(":imageId")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary: "Remove image metadata; durable storage cleanup is retried asynchronously",
	})
	async remove(
		@Req() req: { user: AuthenticatedUser },
		@Param("tripId", ParseUUIDPipe) tripId: string,
		@Param("imageId", ParseUUIDPipe) imageId: string
	) {
		return {
			images: await this.images.remove(req.user.userId, tripId, imageId),
			storageCleanup: "queued" as const,
		};
	}
}

import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { TripReviewImagesService } from "./trip-review-images.service";

@ApiTags("trip-reviews")
@ApiBearerAuth()
@Controller("trip-reviews/images")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER)
export class TripReviewImagesController {
	constructor(private readonly images: TripReviewImagesService) {}
	@Post()
	@ApiConsumes("multipart/form-data")
	@UseInterceptors(
		FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
	)
	async upload(
		@Req() request: { user: AuthenticatedUser },
		@UploadedFile() file?: Express.Multer.File
	) {
		return this.images.upload(request.user.userId, file);
	}
}

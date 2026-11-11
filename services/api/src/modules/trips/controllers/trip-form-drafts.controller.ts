import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Req,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { UserRole } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection
import { TripFormDraftsService } from "../services/trip-form-drafts.service";
class SaveTripFormDraftDto {
	@ApiProperty() @IsString() @MaxLength(65536) values!: string;
	@ApiProperty({ required: false }) @IsOptional() @IsIn(["true"]) preserveImages?: "true";
	@ApiProperty({ required: false }) @IsOptional() @IsUUID() tripId?: string;
}
class CompleteTripFormDraftDto {
	@ApiProperty() @IsUUID() tripId!: string;
}
@ApiTags("trip-drafts")
@ApiBearerAuth()
@Controller("trip-drafts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HOST)
export class TripFormDraftsController {
	constructor(private readonly drafts: TripFormDraftsService) {}
	@Get()
	@ApiOperation({ summary: "List owned incomplete Trip drafts" })
	list(@Req() req: { user: { userId: string } }) {
		return this.drafts.list(req.user.userId);
	}
	@Get(":id/thumbnail")
	@ApiOperation({ summary: "Get the first image of an owned incomplete Trip draft" })
	thumbnail(@Req() req: { user: { userId: string } }, @Param("id", ParseUUIDPipe) id: string) {
		return this.drafts.thumbnail(req.user.userId, id);
	}
	@Get(":id")
	@ApiOperation({ summary: "Restore an owned Trip draft and its images" })
	get(@Req() req: { user: { userId: string } }, @Param("id", ParseUUIDPipe) id: string) {
		return this.drafts.get(req.user.userId, id);
	}
	@Put(":id")
	@ApiConsumes("multipart/form-data")
	@ApiOperation({ summary: "Save an incomplete Trip form and up to five images atomically" })
	@UseInterceptors(
		FilesInterceptor("images", 5, {
			limits: { fileSize: 5242880, files: 5, fields: 3, fieldSize: 65536 },
		})
	)
	save(
		@Req() req: { user: { userId: string } },
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: SaveTripFormDraftDto,
		@UploadedFiles() files: Express.Multer.File[] = []
	) {
		return this.drafts.save(
			req.user.userId,
			id,
			dto.values,
			files,
			dto.tripId,
			dto.preserveImages === "true"
		);
	}
	@Post(":id/complete")
	@ApiOperation({ summary: "Retire a form draft after creating its Trip" })
	complete(
		@Req() req: { user: { userId: string } },
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: CompleteTripFormDraftDto
	) {
		return this.drafts.complete(req.user.userId, id, dto.tripId);
	}
}

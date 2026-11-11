import {
	Controller,
	Get,
	Header,
	Headers,
	HttpStatus,
	Param,
	ParseIntPipe,
	ParseUUIDPipe,
	Req,
	Res,
	UnprocessableEntityException,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflineBasemapService } from "./offline-basemap.service";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflinePackageDownloadService } from "./offline-package-download.service";

const ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });
const VERSION_PIPE = new ParseIntPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });
interface DownloadHttpResponse {
	status(code: number): DownloadHttpResponse;
	setHeader(name: string, value: string): void;
	end(bytes: Buffer): void;
}

@ApiTags("offline-packages")
@ApiBearerAuth()
@Controller("trips/:tripId/offline-packages")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.PORTER)
@ApiResponse({ status: 404, description: "Trip absent or participation revoked" })
@ApiResponse({ status: 409, description: "Package not READY or unsupported" })
export class OfflinePackageDownloadController {
	constructor(
		private readonly downloads: OfflinePackageDownloadService,
		private readonly basemaps: OfflineBasemapService
	) {}

	@Get(":version/tiles")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "Get immutable basemap bound to this package version" })
	tiles(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ID_PIPE) tripId: string,
		@Param("version", VERSION_PIPE) version: number
	) {
		this.validateVersion(version);
		return this.basemaps.metadata(request.user.userId, tripId, version);
	}

	@Get(":version/tiles/download")
	@Header("Cache-Control", "private, no-store, no-transform")
	@ApiOperation({ summary: "Stream authorized MBTiles; checksum is provided by tiles metadata" })
	tileBytes(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ID_PIPE) tripId: string,
		@Param("version", VERSION_PIPE) version: number
	) {
		this.validateVersion(version);
		return this.basemaps.download(request.user.userId, tripId, version);
	}

	@Get("latest")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "CTMS-053: latest READY package metadata for this participant" })
	latest(@Req() request: { user: AuthenticatedUser }, @Param("tripId", ID_PIPE) tripId: string) {
		return this.downloads.metadata(request.user.userId, tripId);
	}

	@Get(":version")
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({ summary: "CTMS-053: immutable package metadata for resume" })
	metadata(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ID_PIPE) tripId: string,
		@Param("version", VERSION_PIPE) version: number
	) {
		this.validateVersion(version);
		return this.downloads.metadata(request.user.userId, tripId, version);
	}

	@Get(":version/download")
	@ApiOperation({
		summary: "CTMS-053: private ZIP bytes, single Range and strong If-Range supported",
	})
	@ApiResponse({ status: 200, description: "Complete ZIP" })
	@ApiResponse({ status: 206, description: "Requested byte range" })
	@ApiResponse({ status: 416, description: "Unsatisfiable or unsupported Range" })
	async download(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", ID_PIPE) tripId: string,
		@Param("version", VERSION_PIPE) version: number,
		@Headers("range") range: string | undefined,
		@Headers("if-range") ifRange: string | undefined,
		@Res() response: DownloadHttpResponse
	): Promise<void> {
		this.validateVersion(version);
		const result = await this.downloads.download(
			request.user.userId,
			tripId,
			version,
			range,
			ifRange
		);
		response.status(result.status);
		for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
		response.end(result.bytes);
	}
	private validateVersion(version: number): void {
		if (!Number.isSafeInteger(version) || version < 1 || version > 2147483647)
			throw new UnprocessableEntityException("Invalid package version");
	}
}

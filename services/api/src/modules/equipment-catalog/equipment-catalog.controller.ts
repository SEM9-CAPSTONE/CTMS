import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Body validation needs runtime DTO metadata
import { CreateEquipmentCatalogItemDto } from "./dto/create-equipment-catalog-item.dto";
import { EquipmentCatalogItemResponseDto } from "./dto/equipment-catalog-item-response.dto";
// biome-ignore lint/style/useImportType: Body validation needs runtime DTO metadata
import { UpdateEquipmentCatalogItemDto } from "./dto/update-equipment-catalog-item.dto";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { EquipmentCatalogService } from "./equipment-catalog.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const ITEM_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("equipment-catalog")
@ApiBearerAuth()
@Controller("equipment-catalog")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiResponse({ status: 401, description: "Authentication required" })
export class EquipmentCatalogController {
	constructor(private readonly catalog: EquipmentCatalogService) {}

	@Post()
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "Create a new equipment catalog item owned by the current Host" })
	@ApiResponse({ status: 201, type: EquipmentCatalogItemResponseDto })
	@ApiResponse({ status: 403, description: "Host role required" })
	@ApiResponse({ status: 422, description: "Invalid catalog data" })
	create(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateEquipmentCatalogItemDto
	): Promise<EquipmentCatalogItemResponseDto> {
		return this.catalog.create(request.user.userId, dto);
	}

	@Get("mine")
	@Roles(UserRole.HOST)
	@ApiOperation({ summary: "List the current Host's own equipment catalog items" })
	@ApiResponse({ status: 200, type: EquipmentCatalogItemResponseDto, isArray: true })
	@ApiResponse({ status: 403, description: "Host role required" })
	listMine(@Req() request: AuthenticatedRequest): Promise<EquipmentCatalogItemResponseDto[]> {
		return this.catalog.listMine(request.user.userId);
	}

	@Get(":itemId")
	@Roles(UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Read one equipment catalog item" })
	@ApiResponse({ status: 200, type: EquipmentCatalogItemResponseDto })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Equipment catalog item not found" })
	getItem(
		@Req() request: AuthenticatedRequest,
		@Param("itemId", ITEM_ID_PIPE) itemId: string
	): Promise<EquipmentCatalogItemResponseDto> {
		return this.catalog.getItem(request.user, itemId);
	}

	@Patch(":itemId")
	@Roles(UserRole.HOST, UserRole.ADMIN)
	@ApiOperation({ summary: "Update an equipment catalog item" })
	@ApiResponse({ status: 200, type: EquipmentCatalogItemResponseDto })
	@ApiResponse({ status: 403, description: "Not the owning Host, and not an Admin" })
	@ApiResponse({ status: 404, description: "Equipment catalog item not found" })
	@ApiResponse({ status: 422, description: "Invalid catalog data" })
	update(
		@Req() request: AuthenticatedRequest,
		@Param("itemId", ITEM_ID_PIPE) itemId: string,
		@Body() dto: UpdateEquipmentCatalogItemDto
	): Promise<EquipmentCatalogItemResponseDto> {
		return this.catalog.update(request.user, itemId, dto);
	}
}

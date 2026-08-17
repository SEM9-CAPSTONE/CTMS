import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: used as a @Body() parameter type, needs design:paramtypes metadata for NestJS validation
import { AccountStatusActionDto } from "./dto/account-status-action.dto";
// biome-ignore lint/style/useImportType: used as a @Query() parameter type, needs design:paramtypes metadata for NestJS validation
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import {
	PaginatedUserAccountsResponseDto,
	UserAccountDetailDto,
} from "./dto/user-account-response.dto";
import { UserRole } from "./entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { UsersService } from "./users.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const USER_ID_PIPE = new ParseUUIDPipe({
	errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get()
	@ApiOperation({ summary: "List and search user accounts" })
	@ApiResponse({ status: 200, type: PaginatedUserAccountsResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	@ApiResponse({ status: 422, description: "Invalid query" })
	listUsers(
		@Req() request: AuthenticatedRequest,
		@Query() query: ListUsersQueryDto
	): Promise<PaginatedUserAccountsResponseDto> {
		return this.usersService.listUsers(request.user.userId, query);
	}

	@Get(":userId")
	@ApiOperation({ summary: "View a user account" })
	@ApiResponse({ status: 200, type: UserAccountDetailDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin access required" })
	@ApiResponse({ status: 404, description: "User account not found" })
	getUser(
		@Req() request: AuthenticatedRequest,
		@Param("userId", USER_ID_PIPE) userId: string
	): Promise<UserAccountDetailDto> {
		return this.usersService.getUser(request.user.userId, userId);
	}

	@Patch(":userId/lock")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Lock an active user account" })
	@ApiResponse({ status: 200, type: UserAccountDetailDto })
	@ApiResponse({ status: 409, description: "Invalid account status transition" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	lockUser(
		@Req() request: AuthenticatedRequest,
		@Param("userId", USER_ID_PIPE) userId: string,
		@Body() dto: AccountStatusActionDto
	): Promise<UserAccountDetailDto> {
		return this.usersService.lockUser(request.user.userId, userId, dto);
	}

	@Patch(":userId/unlock")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Unlock a suspended user account" })
	@ApiResponse({ status: 200, type: UserAccountDetailDto })
	@ApiResponse({ status: 409, description: "Invalid account status transition" })
	@ApiResponse({ status: 422, description: "Invalid input" })
	unlockUser(
		@Req() request: AuthenticatedRequest,
		@Param("userId", USER_ID_PIPE) userId: string,
		@Body() dto: AccountStatusActionDto
	): Promise<UserAccountDetailDto> {
		return this.usersService.unlockUser(request.user.userId, userId, dto);
	}
}

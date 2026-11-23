import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: body DTO class carries the class-validator metadata used at runtime
import {
	PlatformBankAccountDto,
	PlatformBankAccountResponseDto,
	UpsertPlatformBankAccountDto,
} from "./platform-bank-account.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { PlatformBankAccountsService } from "./platform-bank-accounts.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

/** Admin › Tài chính: the account Hosts transfer unpaid weather penalties to (policy §6). */
@ApiTags("platform-bank-accounts")
@ApiBearerAuth()
@Controller("admin/platform-bank-account")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PlatformBankAccountsController {
	constructor(private readonly service: PlatformBankAccountsService) {}

	@Get()
	@ApiOperation({ summary: "The bank account that receives weather penalty transfers" })
	@ApiResponse({ status: 200, type: PlatformBankAccountResponseDto })
	async get(): Promise<PlatformBankAccountResponseDto> {
		return { account: await this.service.get("weather_penalty") };
	}

	@Put()
	@ApiOperation({ summary: "Set or change the bank account that receives weather penalties" })
	@ApiResponse({ status: 200, type: PlatformBankAccountDto })
	@ApiResponse({ status: 422, description: "Invalid bank name, account number or holder name" })
	upsert(
		@Req() req: AuthenticatedRequest,
		@Body() dto: UpsertPlatformBankAccountDto
	): Promise<PlatformBankAccountDto> {
		return this.service.upsert(req.user.userId, "weather_penalty", dto);
	}
}

import {
	Body,
	Controller,
	Delete,
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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import { UserRole } from "../../users/entities/user.entity";
import { BankAccountResponseDto } from "../dto/bank-account-response.dto";
// biome-ignore lint/style/useImportType: used as @Body() parameter type, needs design:paramtypes metadata for NestJS validation pipeline
import { CreateBankAccountDto } from "../dto/create-bank-account.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { UserBankAccountsService } from "../services/user-bank-accounts.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

@ApiTags("bank-accounts")
@ApiBearerAuth()
@Controller("profiles/me/bank-accounts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CAMPER, UserRole.HOST, UserRole.PORTER, UserRole.ADMIN)
export class UserBankAccountsController {
	constructor(private readonly bankAccountsService: UserBankAccountsService) {}

	@Get()
	@ApiOperation({ summary: "Get all linked bank accounts of the authenticated user" })
	@ApiResponse({
		status: 200,
		description: "Bank accounts retrieved",
		type: [BankAccountResponseDto],
	})
	getBankAccounts(@Req() request: AuthenticatedRequest): Promise<BankAccountResponseDto[]> {
		return this.bankAccountsService.getBankAccounts(request.user.userId);
	}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Add and link a new receiving bank account" })
	@ApiResponse({
		status: 201,
		description: "Bank account created",
		type: BankAccountResponseDto,
	})
	@ApiResponse({ status: 400, description: "Name mismatch or missing profile full name" })
	@ApiResponse({ status: 409, description: "Bank account already linked" })
	addBankAccount(
		@Req() request: AuthenticatedRequest,
		@Body() dto: CreateBankAccountDto
	): Promise<BankAccountResponseDto> {
		return this.bankAccountsService.addBankAccount(request.user.userId, dto);
	}

	@Delete(":id")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Delete a linked bank account" })
	@ApiResponse({ status: 200, description: "Bank account deleted" })
	@ApiResponse({ status: 404, description: "Bank account not found" })
	deleteBankAccount(
		@Req() request: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<{ success: boolean }> {
		return this.bankAccountsService.deleteBankAccount(request.user.userId, id);
	}

	@Patch(":id/default")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Set a linked bank account as default" })
	@ApiResponse({
		status: 200,
		description: "Bank account set as default",
		type: BankAccountResponseDto,
	})
	@ApiResponse({ status: 404, description: "Bank account not found" })
	setDefaultBankAccount(
		@Req() request: AuthenticatedRequest,
		@Param("id", ParseUUIDPipe) id: string
	): Promise<BankAccountResponseDto> {
		return this.bankAccountsService.setDefaultBankAccount(request.user.userId, id);
	}
}

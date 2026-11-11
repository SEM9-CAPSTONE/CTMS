import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { AdminSettlementQueryDto } from "./dto/admin-settlement-query.dto";
// biome-ignore lint/style/useImportType: DTO classes used with @Body() must be imported as values for NestJS validation metadata
import {
	ConfirmHostPayoutDto,
	HostWalletResponseDto,
	RejectHostPayoutDto,
	RequestHostPayoutDto,
} from "./dto/host-payout.dto";
import {
	SettlementResponseDto,
	TripSettlementEvaluationDto,
} from "./dto/trip-settlement-evaluation.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { SettlementsService } from "./settlements.service";

@ApiTags("settlements")
@Controller("settlements")
export class SettlementsController {
	constructor(private readonly settlementsService: SettlementsService) {}

	@Get("trips/:tripId/evaluation")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.HOST)
	@ApiOperation({
		summary:
			"Evaluate settlement eligibility, hold status, and platform fee breakdown for a Trip (CTMS-112)",
	})
	@ApiResponse({ status: 200, type: TripSettlementEvaluationDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin or Host role required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	evaluateTripSettlement(
		@Param("tripId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		tripId: string
	): Promise<TripSettlementEvaluationDto> {
		return this.settlementsService.evaluateTripSettlement(tripId);
	}

	@Post("trips/:tripId/settle")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary:
			"Finalize Trip settlement, snapshot 5% Platform Fee, and credit Host Wallet (CTMS-112)",
	})
	@ApiResponse({ status: 201, type: SettlementResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Settlement conditions not satisfied or blocked" })
	settleTrip(
		@Req() request: { user: AuthenticatedUser },
		@Param("tripId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		tripId: string
	): Promise<SettlementResponseDto> {
		return this.settlementsService.settleTrip(tripId, request.user.userId);
	}

	@Get("admin")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: "List trips for settlement overview and processing (CTMS-112)",
	})
	@ApiResponse({ status: 200, description: "List of trips with settlement evaluations" })
	listAdminSettlements(@Query() query: AdminSettlementQueryDto) {
		return this.settlementsService.listAdminSettlements(query);
	}

	@Get("host/wallet")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary: "Get Host wallet balance, pending payout, and transaction history (CTMS-112)",
	})
	@ApiResponse({ status: 200, type: HostWalletResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	getHostWallet(@Req() request: { user: AuthenticatedUser }): Promise<HostWalletResponseDto> {
		return this.settlementsService.getHostWallet(request.user.userId);
	}

	@Post("host/payout")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.HOST)
	@ApiOperation({
		summary:
			"Request full-amount withdrawal from Host Wallet to bank account (CTMS-112 / CTMS-113)",
	})
	@ApiResponse({ status: 201, description: "Payout request created" })
	@ApiResponse({ status: 400, description: "Invalid bank details" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Host role required" })
	@ApiResponse({ status: 409, description: "Insufficient balance or active payout pending" })
	requestHostPayout(
		@Req() request: { user: AuthenticatedUser },
		@Body() dto: RequestHostPayoutDto
	) {
		return this.settlementsService.requestHostPayout(request.user.userId, dto);
	}

	@Get("admin/payouts")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: "List Host Payout requests for Admin reconciliation (CTMS-112 / CTMS-113)",
	})
	@ApiResponse({ status: 200, description: "List of payouts" })
	listAdminPayouts(
		@Query("status") status?: string,
		@Query("search") search?: string,
		@Query("page") page?: number,
		@Query("limit") limit?: number
	) {
		return this.settlementsService.listAdminPayouts({
			status,
			search,
			page: page ? Number(page) : undefined,
			limit: limit ? Number(limit) : undefined,
		});
	}

	@Post("admin/payouts/:id/confirm")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: "Confirm manual bank transfer for Host Payout (CTMS-112 / CTMS-113)",
	})
	@ApiResponse({ status: 200, description: "Payout marked succeeded" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Payout not found" })
	@ApiResponse({ status: 409, description: "Payout not pending" })
	confirmHostPayout(
		@Req() request: { user: AuthenticatedUser },
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		payoutId: string,
		@Body() dto: ConfirmHostPayoutDto
	) {
		return this.settlementsService.confirmHostPayout(payoutId, request.user.userId, dto);
	}

	@Post("admin/payouts/:id/reject")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: "Reject Host Payout request and restore wallet balance (CTMS-112 / CTMS-113)",
	})
	@ApiResponse({ status: 200, description: "Payout rejected and balance restored" })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Payout not found" })
	@ApiResponse({ status: 409, description: "Payout not pending" })
	rejectHostPayout(
		@Req() request: { user: AuthenticatedUser },
		@Param("id", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		payoutId: string,
		@Body() dto: RejectHostPayoutDto
	) {
		return this.settlementsService.rejectHostPayout(payoutId, request.user.userId, dto);
	}
}

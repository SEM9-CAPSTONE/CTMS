import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
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
import { AdminRefundListResponseDto } from "./dto/admin-refund-item-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { AdminRefundListQueryDto } from "./dto/admin-refund-list-query.dto";
import { BookingRefundInfoResponseDto } from "./dto/booking-refund-info-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { ConfirmManualRefundDto } from "./dto/confirm-manual-refund.dto";
import { ProcessRefundResponseDto } from "./dto/process-refund-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { ProcessRefundDto } from "./dto/process-refund.dto";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { RefundCallbackDto } from "./dto/refund-callback.dto";
// biome-ignore lint/style/useImportType: decorated NestJS DTO requires runtime metadata
import { RejectRefundDto } from "./dto/reject-refund.dto";
import { SettlementStatusResponseDto } from "./dto/settlement-status-response.dto";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { RefundsService } from "./refunds.service";

@ApiTags("refunds")
@Controller()
export class RefundsController {
	constructor(private readonly refundsService: RefundsService) {}

	@Get("bookings/:bookingId/refunds")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.CAMPER)
	@ApiOperation({
		summary: "Get refund eligibility, windows, and refund history for a Booking (CTMS-035)",
	})
	@ApiResponse({ status: 200, type: BookingRefundInfoResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role or Booking ownership required" })
	@ApiResponse({ status: 404, description: "Booking not found" })
	getBookingRefundInfo(
		@Req() request: { user: AuthenticatedUser },
		@Param("bookingId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		bookingId: string
	): Promise<BookingRefundInfoResponseDto> {
		return this.refundsService.getBookingRefundInfo(
			request.user.userId,
			request.user.roles,
			bookingId
		);
	}

	@Post("bookings/:bookingId/refunds")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.CAMPER)
	@ApiOperation({
		summary: "Process an approved refund for a Booking (CTMS-035)",
	})
	@ApiResponse({ status: 201, type: ProcessRefundResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role or Booking ownership required" })
	@ApiResponse({ status: 404, description: "Booking or parent charge not found" })
	@ApiResponse({ status: 409, description: "Refund eligibility, window, or amount conflict" })
	@ApiResponse({ status: 422, description: "Invalid payload or idempotency key" })
	processRefund(
		@Req() request: { user: AuthenticatedUser },
		@Param("bookingId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		bookingId: string,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: ProcessRefundDto
	): Promise<ProcessRefundResponseDto> {
		return this.refundsService.processRefund(request.user.userId, bookingId, idempotencyKey, dto, {
			userRoles: request.user.roles,
		});
	}

	@Post("bookings/:bookingId/refunds/:obligationId/process")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.CAMPER)
	@ApiOperation({
		summary: "Process an existing approved refund obligation (CTMS-035)",
	})
	@ApiResponse({ status: 200, type: ProcessRefundResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Booking or refund obligation not found" })
	@ApiResponse({ status: 409, description: "Refund eligibility or window conflict" })
	@ApiResponse({ status: 422, description: "Invalid UUID or idempotency key" })
	processObligation(
		@Req() request: { user: AuthenticatedUser },
		@Param("bookingId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		bookingId: string,
		@Param(
			"obligationId",
			new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
		)
		obligationId: string,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: ProcessRefundDto
	): Promise<ProcessRefundResponseDto> {
		return this.refundsService.processRefund(request.user.userId, bookingId, idempotencyKey, {
			...dto,
			obligationId,
		});
	}

	@Get("trips/:tripId/settlement-status")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.HOST)
	@ApiOperation({
		summary: "Get settlement blocking status and Held Funds accounting for a Trip (CTMS-035)",
	})
	@ApiResponse({ status: 200, type: SettlementStatusResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin or Host role required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	getSettlementStatus(
		@Param("tripId", new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
		tripId: string
	): Promise<SettlementStatusResponseDto> {
		return this.refundsService.getSettlementStatus(tripId);
	}

	@Post("bookings/refund-webhook")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Handle provider refund reconciliation callback (CTMS-035)" })
	@ApiResponse({ status: 200, description: "Callback processed successfully" })
	handleRefundWebhook(
		@Body() dto: RefundCallbackDto
	): Promise<{ success: boolean; replayed: boolean }> {
		return this.refundsService.reconcileProviderRefundCallback(dto);
	}

	@Get("admin/refunds")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "List all refund requests for Admin management (CTMS-035)" })
	@ApiResponse({ status: 200, type: AdminRefundListResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	listAdminRefunds(@Query() query: AdminRefundListQueryDto): Promise<AdminRefundListResponseDto> {
		return this.refundsService.listAdminRefunds(query);
	}

	@Post("admin/refunds/:obligationId/confirm")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Confirm manual bank transfer for a refund obligation (CTMS-035)" })
	@ApiResponse({ status: 200, type: ProcessRefundResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Refund obligation not found" })
	@ApiResponse({ status: 409, description: "Refund state conflict" })
	confirmManualRefund(
		@Req() request: { user: AuthenticatedUser },
		@Param(
			"obligationId",
			new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
		)
		obligationId: string,
		@Body() dto: ConfirmManualRefundDto
	): Promise<ProcessRefundResponseDto> {
		return this.refundsService.confirmManualRefund(request.user.userId, obligationId, dto);
	}

	@Post("admin/refunds/:obligationId/reject")
	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: "Reject a refund request (CTMS-035)" })
	@ApiResponse({ status: 200, type: ProcessRefundResponseDto })
	@ApiResponse({ status: 401, description: "Authentication required" })
	@ApiResponse({ status: 403, description: "Admin role required" })
	@ApiResponse({ status: 404, description: "Refund obligation not found" })
	@ApiResponse({ status: 409, description: "Refund state conflict" })
	rejectRefund(
		@Req() request: { user: AuthenticatedUser },
		@Param(
			"obligationId",
			new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
		)
		obligationId: string,
		@Body() dto: RejectRefundDto
	): Promise<ProcessRefundResponseDto> {
		return this.refundsService.rejectRefund(request.user.userId, obligationId, dto);
	}
}

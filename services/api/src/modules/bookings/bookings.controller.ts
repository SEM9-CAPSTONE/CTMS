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
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsService } from "./bookings.service";
import { AddBookingItemResponseDto } from "./dto/add-booking-item-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { AddBookingItemDto } from "./dto/add-booking-item.dto";
import { BookingDetailsResponseDto } from "./dto/booking-details-response.dto";
import { BookingItemResponseDto } from "./dto/booking-item-response.dto";
import { BookingResponseDto } from "./dto/booking-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { CreateBookingDto } from "./dto/create-booking.dto";
import { InitializeBookingMembersResponseDto } from "./dto/initialize-booking-members-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { InitializeBookingMembersDto } from "./dto/initialize-booking-members.dto";
import { PackingListResponseDto } from "./dto/packing-list-response.dto";
import { PayBookingResponseDto } from "./dto/pay-booking-response.dto";
// biome-ignore lint/style/useImportType: decorated NestJS parameter needs runtime metadata
import { PayBookingDto } from "./dto/pay-booking.dto";
import {
	type ResolveBookingMemberCandidateDto,
	ResolveBookingMemberCandidateResponseDto,
} from "./dto/resolve-booking-member-candidate.dto";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { PaymentsService } from "./payments.service";

interface AuthenticatedRequest {
	user: AuthenticatedUser;
}

const BOOKING_ID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY });

@ApiTags("bookings")
@ApiBearerAuth()
@Controller("bookings")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiResponse({ status: 401, description: "Authentication required" })
export class BookingsController {
	constructor(
		private readonly bookingsService: BookingsService,
		private readonly paymentsService: PaymentsService
	) {}

	@Post()
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Create a Booking for an eligible published Trip" })
	@ApiHeader({
		name: "Idempotency-Key",
		required: true,
		description: "Stable key for one booking attempt",
	})
	@ApiResponse({ status: 201, type: BookingResponseDto })
	@ApiResponse({ status: 403, description: "Camper role required" })
	@ApiResponse({ status: 404, description: "Trip not found" })
	@ApiResponse({ status: 409, description: "Trip or idempotency conflict" })
	@ApiResponse({ status: 422, description: "Invalid payload or Idempotency-Key" })
	create(
		@Req() request: AuthenticatedRequest,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: CreateBookingDto
	): Promise<BookingResponseDto> {
		return this.bookingsService.create(request.user.userId, idempotencyKey, dto);
	}

	@Post(":bookingId/member-candidates/resolve")
	@HttpCode(HttpStatus.OK)
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Resolve one eligible Booking participant by exact email" })
	@ApiResponse({ status: 200, type: ResolveBookingMemberCandidateResponseDto })
	@ApiResponse({ status: 403, description: "Camper role or Booking ownership required" })
	@ApiResponse({ status: 404, description: "Booking or eligible participant not found" })
	@ApiResponse({ status: 409, description: "Booking is not open for participant resolution" })
	@ApiResponse({ status: 422, description: "Invalid Booking id or email payload" })
	resolveMemberCandidate(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string,
		@Body() dto: ResolveBookingMemberCandidateDto
	): Promise<ResolveBookingMemberCandidateResponseDto> {
		return this.bookingsService.resolveMemberCandidate(request.user.userId, bookingId, dto);
	}

	@Post(":bookingId/members")
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Initialize the complete participant roster for a Booking" })
	@ApiHeader({
		name: "Idempotency-Key",
		required: true,
		description: "Stable key for one roster-initialization attempt",
	})
	@ApiResponse({ status: 201, type: InitializeBookingMembersResponseDto })
	@ApiResponse({ status: 403, description: "Camper role or Booking ownership required" })
	@ApiResponse({ status: 404, description: "Booking, Trip, or participant user not found" })
	@ApiResponse({
		status: 409,
		description: "Roster already initialized, invalid Booking state, or roster conflict",
	})
	@ApiResponse({ status: 422, description: "Invalid payload, Booking id, or Idempotency-Key" })
	initializeMembers(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: InitializeBookingMembersDto
	): Promise<InitializeBookingMembersResponseDto> {
		return this.bookingsService.initializeMembers(
			request.user.userId,
			bookingId,
			idempotencyKey,
			dto
		);
	}

	@Post(":bookingId/items")
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Add an equipment rental item to the caller's own Booking" })
	@ApiHeader({
		name: "Idempotency-Key",
		required: true,
		description: "Stable key for one add-item attempt",
	})
	@ApiResponse({ status: 201, type: AddBookingItemResponseDto })
	@ApiResponse({ status: 403, description: "Not the Booking owner" })
	@ApiResponse({ status: 404, description: "Booking, Trip, or Equipment catalog item not found" })
	@ApiResponse({
		status: 409,
		description: "Booking not open, or insufficient equipment availability",
	})
	@ApiResponse({
		status: 422,
		description: "Invalid payload, inactive equipment, or wrong Host scope",
	})
	addItem(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: AddBookingItemDto
	): Promise<AddBookingItemResponseDto> {
		return this.bookingsService.addItem(request.user.userId, bookingId, idempotencyKey, dto);
	}

	@Get(":bookingId/items")
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "List the equipment rental items on the caller's own Booking" })
	@ApiResponse({ status: 200, type: BookingItemResponseDto, isArray: true })
	@ApiResponse({ status: 403, description: "Not the Booking owner" })
	@ApiResponse({ status: 404, description: "Booking not found" })
	listItems(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string
	): Promise<BookingItemResponseDto[]> {
		return this.bookingsService.listItems(request.user.userId, bookingId);
	}

	@Post(":bookingId/pay")
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Pay for a Booking" })
	@ApiHeader({
		name: "Idempotency-Key",
		required: true,
		description: "Stable key for one pay attempt",
	})
	@ApiResponse({ status: 201, type: PayBookingResponseDto })
	@ApiResponse({ status: 403, description: "Camper role or Booking ownership required" })
	@ApiResponse({ status: 404, description: "Booking not found" })
	@ApiResponse({
		status: 409,
		description: "Booking is not in a payable state, or idempotency conflict",
	})
	@ApiResponse({ status: 422, description: "Invalid payload, bookingId, or Idempotency-Key" })
	pay(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string,
		@Headers("idempotency-key") idempotencyKey: string | undefined,
		@Body() dto: PayBookingDto,
		@Headers("x-mock-payment") mockPaymentHeader?: string
	): Promise<PayBookingResponseDto> {
		if (mockPaymentHeader) {
			return this.paymentsService.pay(request.user.userId, bookingId, idempotencyKey, dto, {
				mockProvider: mockPaymentHeader === "true",
			});
		}
		return this.paymentsService.pay(request.user.userId, bookingId, idempotencyKey, dto);
	}

	@Get(":bookingId/packing-list")
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "Compute a personalized packing list for the caller's own Booking" })
	@ApiResponse({ status: 200, type: PackingListResponseDto })
	@ApiResponse({ status: 403, description: "Not the Booking owner" })
	@ApiResponse({ status: 404, description: "Booking not found" })
	@ApiResponse({ status: 409, description: "Trip context is no longer available" })
	getPackingList(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string
	): Promise<PackingListResponseDto> {
		return this.bookingsService.getPackingList(request.user.userId, bookingId);
	}

	@Get(":bookingId")
	@Roles(UserRole.CAMPER)
	@ApiOperation({ summary: "View the authenticated Camper's Booking details" })
	@ApiResponse({ status: 200, type: BookingDetailsResponseDto })
	@ApiResponse({ status: 403, description: "Existing Booking is owned by another Camper" })
	@ApiResponse({ status: 404, description: "Booking not found" })
	@ApiResponse({ status: 422, description: "Malformed Booking id" })
	getBookingDetails(
		@Req() request: AuthenticatedRequest,
		@Param("bookingId", BOOKING_ID_PIPE) bookingId: string
	): Promise<BookingDetailsResponseDto> {
		return this.bookingsService.getBookingDetails(request.user.userId, bookingId);
	}
}

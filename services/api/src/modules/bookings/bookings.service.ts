import { createHash } from "node:crypto";
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import {
	type Booking,
	BookingPaymentStatus,
	BookingStatus,
} from "../profiles/entities/booking.entity";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { TripStatus } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { type LockedTripForBooking, TripsRepository } from "../trips/repositories/trips.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsRepository } from "./bookings.repository";
import type { BookingResponseDto } from "./dto/booking-response.dto";
import type { CreateBookingDto } from "./dto/create-booking.dto";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const DEFAULT_BOOKING_HOLD_TTL_MINUTES = 15;
const MILLISECONDS_PER_MINUTE = 60_000;
const MAX_NUMERIC_12_2_CENTS = 999_999_999_999n;

@Injectable()
export class BookingsService {
	constructor(
		private readonly bookingsRepository: BookingsRepository,
		private readonly tripsRepository: TripsRepository,
		private readonly weatherRiskService: RouteRegistrationRiskService,
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService
	) {}

	async create(
		userId: string,
		idempotencyKey: string | undefined,
		dto: CreateBookingDto
	): Promise<BookingResponseDto> {
		const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
		const requestFingerprint = this.fingerprint(dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const bookingRepository = manager.withRepository(this.bookingsRepository);
			await bookingRepository.lockIdempotencyKey(userId, normalizedKey);

			const replay = await bookingRepository.findByIdempotencyKey(userId, normalizedKey);
			if (replay) {
				if (replay.requestFingerprint !== requestFingerprint) {
					throw new ConflictException("Idempotency-Key was already used with a different payload");
				}
				return this.toResponse(replay);
			}

			const tripRepository = manager.withRepository(this.tripsRepository);
			const trip = await tripRepository.findByIdForBooking(dto.tripId);
			this.assertTripEligible(trip, dto.numPeople);
			await this.weatherRiskService.assertBookingWeatherAllowed(trip.routeId, manager);

			const basePrice = this.calculateBasePrice(trip.pricePerPerson, dto.numPeople);
			const isFree = basePrice === "0.00";
			const createdAt = new Date();
			const holdExpiresAt = isFree
				? null
				: new Date(createdAt.getTime() + this.getHoldTtlMinutes() * MILLISECONDS_PER_MINUTE);
			const booking = bookingRepository.create({
				tripId: trip.id,
				userId,
				numPeople: dto.numPeople,
				status: isFree ? BookingStatus.CONFIRMED : BookingStatus.PENDING_PAYMENT,
				paymentStatus: isFree ? BookingPaymentStatus.NOT_REQUIRED : BookingPaymentStatus.UNPAID,
				holdExpiresAt,
				tripStartsAtSnapshot: trip.startsAt,
				tripEndsAtSnapshot: trip.endsAt,
				basePrice,
				cancellationPolicySnapshot: trip.cancellationPolicy,
				idempotencyKey: normalizedKey,
				requestFingerprint,
				createdAt,
			});
			const saved = await bookingRepository.save(booking);
			await tripRepository.adjustSeatsTaken(trip.id, dto.numPeople);
			await manager.getRepository(AuditLog).save({
				actorId: userId,
				action: "booking.created",
				targetType: "booking",
				targetId: saved.id,
				before: null,
				after: this.auditSnapshot(saved),
				reason: "camper_create_booking",
			});

			return this.toResponse(saved);
		});
	}

	private assertTripEligible(
		trip: LockedTripForBooking | null,
		numPeople: number
	): asserts trip is LockedTripForBooking {
		if (!trip) throw new NotFoundException("Trip not found");
		if (trip.status !== TripStatus.PUBLISHED) {
			throw new ConflictException("Trip is not available for booking");
		}
		const now = new Date();
		if (trip.bookingDeadline <= now) throw new ConflictException("Booking deadline has passed");
		if (trip.startsAt <= now) throw new ConflictException("Trip has already started");
		if (trip.routeStatus !== TrekkingRouteStatus.ACTIVE) {
			throw new ConflictException("Trip route is not active");
		}
		if (!Number.isSafeInteger(numPeople) || numPeople < 1) {
			throw this.validationError("numPeople", "numPeople must be a positive integer");
		}
		if (trip.capacityMax !== null && trip.seatsTaken + numPeople > trip.capacityMax) {
			throw new ConflictException(
				`Trip has only ${trip.capacityMax - trip.seatsTaken} seat(s) remaining`
			);
		}
	}

	private validateIdempotencyKey(value: string | undefined): string {
		const key = value?.trim();
		if (!key || key.length > IDEMPOTENCY_KEY_MAX_LENGTH || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
			throw this.validationError(
				"Idempotency-Key",
				"Idempotency-Key is required and must contain 1-128 letters, numbers, dots, underscores, colons, or hyphens"
			);
		}
		return key;
	}

	private getHoldTtlMinutes(): number {
		const rawValue =
			this.configService.get<string>("BOOKING_HOLD_TTL_MINUTES") ??
			String(DEFAULT_BOOKING_HOLD_TTL_MINUTES);
		const value = Number(rawValue);
		if (!Number.isSafeInteger(value) || value <= 0) {
			throw new Error("BOOKING_HOLD_TTL_MINUTES must be a positive integer");
		}
		return value;
	}

	private fingerprint(dto: CreateBookingDto): string {
		return createHash("sha256")
			.update(JSON.stringify({ tripId: dto.tripId, numPeople: dto.numPeople }))
			.digest("hex");
	}

	private calculateBasePrice(pricePerPerson: string, numPeople: number): string {
		const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(pricePerPerson);
		if (!match) throw new Error("Stored Trip price is not a valid numeric(12,2) value");
		const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
		const totalCents = cents * BigInt(numPeople);
		if (totalCents > MAX_NUMERIC_12_2_CENTS) {
			throw new ConflictException("Booking subtotal exceeds the supported monetary limit");
		}
		return `${totalCents / 100n}.${(totalCents % 100n).toString().padStart(2, "0")}`;
	}

	private auditSnapshot(booking: Booking): Record<string, unknown> {
		return {
			tripId: booking.tripId,
			userId: booking.userId,
			numPeople: booking.numPeople,
			status: booking.status,
			paymentStatus: booking.paymentStatus,
			holdExpiresAt: booking.holdExpiresAt,
			tripStartsAtSnapshot: booking.tripStartsAtSnapshot,
			tripEndsAtSnapshot: booking.tripEndsAtSnapshot,
			basePrice: booking.basePrice,
		};
	}

	private toResponse(booking: Booking): BookingResponseDto {
		if (
			booking.numPeople === null ||
			booking.status === null ||
			booking.paymentStatus === null ||
			booking.tripStartsAtSnapshot === null ||
			booking.tripEndsAtSnapshot === null ||
			booking.basePrice === null
		) {
			throw new Error("Authoritative Booking is missing required creation fields");
		}
		return {
			id: booking.id,
			tripId: booking.tripId,
			userId: booking.userId,
			numPeople: booking.numPeople,
			status: booking.status,
			paymentStatus: booking.paymentStatus,
			holdExpiresAt: booking.holdExpiresAt,
			tripStartsAtSnapshot: booking.tripStartsAtSnapshot,
			tripEndsAtSnapshot: booking.tripEndsAtSnapshot,
			basePrice: booking.basePrice,
			cancellationPolicySnapshot: booking.cancellationPolicySnapshot,
			createdAt: booking.createdAt,
		};
	}

	private validationError(field: string, error: string): UnprocessableEntityException {
		return new UnprocessableEntityException({
			statusCode: 422,
			error: "Unprocessable Entity",
			message: [{ field, errors: [error] }],
		});
	}
}

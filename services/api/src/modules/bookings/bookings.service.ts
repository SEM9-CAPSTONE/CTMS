import { createHash } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { EquipmentCatalogStatus } from "../equipment-catalog/equipment-catalog-status.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import {
	type Booking,
	BookingPaymentStatus,
	BookingStatus,
} from "../profiles/entities/booking.entity";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { type LockedTripForBooking, TripsRepository } from "../trips/repositories/trips.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import { BookingItemType } from "./booking-item-type.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingItemsRepository } from "./booking-items.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsRepository } from "./bookings.repository";
import type { AddBookingItemResponseDto } from "./dto/add-booking-item-response.dto";
import type { AddBookingItemDto } from "./dto/add-booking-item.dto";
import type { BookingItemResponseDto } from "./dto/booking-item-response.dto";
import type { BookingResponseDto } from "./dto/booking-response.dto";
import type { CreateBookingDto } from "./dto/create-booking.dto";
import type { BookingItem } from "./entities/booking-item.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const DEFAULT_BOOKING_HOLD_TTL_MINUTES = 15;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_NUMERIC_12_2_CENTS = 999_999_999_999n;
const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
	BookingStatus.CANCELLED,
	BookingStatus.EXPIRED,
	BookingStatus.COMPLETED,
];

@Injectable()
export class BookingsService {
	constructor(
		private readonly bookingsRepository: BookingsRepository,
		private readonly tripsRepository: TripsRepository,
		private readonly weatherRiskService: RouteRegistrationRiskService,
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly bookingItemsRepository: BookingItemsRepository,
		private readonly equipmentCatalogRepository: EquipmentCatalogRepository,
		private readonly equipmentReservationsRepository: EquipmentReservationsRepository
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
				totalAmount: basePrice,
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

	/**
	 * CTMS-040-T01. Adds one equipment rental line item to an existing
	 * Booking, then recalculates the Booking's authoritative `totalAmount`
	 * (BR-122/175: server-computed, never client-supplied). Rental range is
	 * the Booking's own trip-date snapshot (no separate rental-date picker
	 * exists anywhere in this codebase); equipment must belong to the same
	 * Host as the booked Trip (BR-183 business-scope) and be `active`
	 * (BR-127). Concurrent adds against the same equipment are serialized by
	 * a pessimistic lock on the EquipmentCatalogItem row so the summed
	 * reservations for any overlapping date range can never exceed
	 * `quantityTotal` (BR-129).
	 */
	async addItem(
		userId: string,
		bookingId: string,
		idempotencyKey: string | undefined,
		dto: AddBookingItemDto
	): Promise<AddBookingItemResponseDto> {
		const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
		const requestFingerprint = this.fingerprintItem(bookingId, dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const bookingItemsRepository = manager.withRepository(this.bookingItemsRepository);
			await bookingItemsRepository.lockIdempotencyKey(bookingId, normalizedKey);

			const replay = await bookingItemsRepository.findByIdempotencyKey(bookingId, normalizedKey);
			if (replay) {
				if (replay.requestFingerprint !== requestFingerprint) {
					throw new ConflictException("Idempotency-Key was already used with a different payload");
				}
				const existingBooking = await manager
					.withRepository(this.bookingsRepository)
					.findOneBy({ id: bookingId });
				if (!existingBooking) throw new NotFoundException("Booking not found");
				return { item: this.toItemResponse(replay), booking: this.toResponse(existingBooking) };
			}

			const bookingRepository = manager.withRepository(this.bookingsRepository);
			const booking = await bookingRepository.findForUpdate(bookingId);
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.userId !== userId) {
				throw new ForbiddenException("Only the Booking owner can add items");
			}
			this.assertBookingOpenForItems(booking);

			const equipmentRepository = manager.withRepository(this.equipmentCatalogRepository);
			const equipment = await equipmentRepository.findForUpdate(dto.equipmentCatalogItemId);
			if (!equipment) throw new NotFoundException("Equipment catalog item not found");
			if (equipment.status !== EquipmentCatalogStatus.ACTIVE) {
				throw this.validationError("equipmentCatalogItemId", "Equipment is not active");
			}

			const trip = await manager
				.getRepository(Trip)
				.findOne({ where: { id: booking.tripId }, select: { id: true, hostId: true } });
			if (!trip) throw new NotFoundException("Trip not found");
			if (equipment.hostId !== trip.hostId) {
				throw this.validationError(
					"equipmentCatalogItemId",
					"Equipment does not belong to this Trip's Host"
				);
			}

			if (!Number.isSafeInteger(dto.quantity) || dto.quantity < 1) {
				throw this.validationError("quantity", "quantity must be a positive integer");
			}

			const tripStartsAt = booking.tripStartsAtSnapshot;
			const tripEndsAt = booking.tripEndsAtSnapshot;
			if (!tripStartsAt || !tripEndsAt) {
				throw new Error("Booking is missing its Trip date snapshot");
			}
			const rentalStartDate = this.toDateOnly(tripStartsAt);
			const rentalEndDate = this.toDateOnly(tripEndsAt);
			const rentalDays = this.calculateRentalDays(tripStartsAt, tripEndsAt);

			const reservationsRepository = manager.withRepository(this.equipmentReservationsRepository);
			const alreadyReserved = await reservationsRepository.sumOverlappingQuantity(
				equipment.id,
				rentalStartDate,
				rentalEndDate
			);
			const remaining = equipment.quantityTotal - alreadyReserved;
			if (dto.quantity > remaining) {
				throw new ConflictException(
					`Only ${Math.max(remaining, 0)} unit(s) of this equipment are available for the requested dates`
				);
			}

			const unitPrice = equipment.rentalPricePerDay.toFixed(2);
			const totalPrice = this.multiplyMoney(unitPrice, dto.quantity, rentalDays);

			const bookingItem = bookingItemsRepository.create({
				bookingId: booking.id,
				itemType: BookingItemType.EQUIPMENT,
				equipmentCatalogItemId: equipment.id,
				quantity: dto.quantity,
				unitPrice,
				rentalDays,
				totalPrice,
				idempotencyKey: normalizedKey,
				requestFingerprint,
			});
			const savedItem = await bookingItemsRepository.save(bookingItem);

			await reservationsRepository.save(
				reservationsRepository.create({
					bookingItemId: savedItem.id,
					equipmentCatalogItemId: equipment.id,
					quantity: dto.quantity,
					rentalStartDate,
					rentalEndDate,
				})
			);

			const itemsTotal = await bookingItemsRepository.sumTotalPriceForBooking(booking.id);
			if (booking.basePrice === null) throw new Error("Booking is missing its base price");
			booking.totalAmount = this.addMoney(booking.basePrice, itemsTotal);
			const savedBooking = await bookingRepository.save(booking);

			await manager.getRepository(AuditLog).save({
				actorId: userId,
				action: "booking_item.added",
				targetType: "booking_item",
				targetId: savedItem.id,
				before: null,
				after: {
					bookingId: booking.id,
					equipmentCatalogItemId: equipment.id,
					quantity: dto.quantity,
					unitPrice,
					rentalDays,
					totalPrice,
				},
				reason: null,
			});

			return { item: this.toItemResponse(savedItem), booking: this.toResponse(savedBooking) };
		});
	}

	async listItems(userId: string, bookingId: string): Promise<BookingItemResponseDto[]> {
		const booking = await this.bookingsRepository.findOneBy({ id: bookingId });
		if (!booking) throw new NotFoundException("Booking not found");
		if (booking.userId !== userId) {
			throw new ForbiddenException("Only the Booking owner can view these items");
		}
		const items = await this.bookingItemsRepository.findByBooking(bookingId);
		return items.map((item) => this.toItemResponse(item));
	}

	private assertBookingOpenForItems(booking: Booking): void {
		if (booking.status === null || TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
			throw new ConflictException("Booking is not open for adding items");
		}
	}

	private toDateOnly(value: Date): string {
		return value.toISOString().slice(0, 10);
	}

	private calculateRentalDays(startsAt: Date, endsAt: Date): number {
		const days = Math.ceil((endsAt.getTime() - startsAt.getTime()) / MILLISECONDS_PER_DAY);
		return Math.max(days, 1);
	}

	private fingerprintItem(bookingId: string, dto: AddBookingItemDto): string {
		return createHash("sha256")
			.update(
				JSON.stringify({
					bookingId,
					equipmentCatalogItemId: dto.equipmentCatalogItemId,
					quantity: dto.quantity,
				})
			)
			.digest("hex");
	}

	private toItemResponse(item: BookingItem): BookingItemResponseDto {
		return {
			id: item.id,
			bookingId: item.bookingId,
			itemType: item.itemType,
			equipmentCatalogItemId: item.equipmentCatalogItemId,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			rentalDays: item.rentalDays,
			totalPrice: item.totalPrice,
			createdAt: item.createdAt,
		};
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
		return this.multiplyMoney(pricePerPerson, numPeople);
	}

	/** Exact decimal multiplication of a numeric(12,2) string by integer factors, via cents. */
	private multiplyMoney(price: string, ...factors: number[]): string {
		const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(price);
		if (!match) throw new Error("Stored price is not a valid numeric(12,2) value");
		let cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
		for (const factor of factors) cents *= BigInt(factor);
		if (cents > MAX_NUMERIC_12_2_CENTS) {
			throw new ConflictException("Amount exceeds the supported monetary limit");
		}
		return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
	}

	private addMoney(a: string, b: string): string {
		const parse = (value: string): bigint => {
			const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value);
			if (!match) throw new Error("Stored price is not a valid numeric(12,2) value");
			return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
		};
		const totalCents = parse(a) + parse(b);
		if (totalCents > MAX_NUMERIC_12_2_CENTS) {
			throw new ConflictException("Amount exceeds the supported monetary limit");
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
			totalAmount: booking.totalAmount,
		};
	}

	private toResponse(booking: Booking): BookingResponseDto {
		if (
			booking.numPeople === null ||
			booking.status === null ||
			booking.paymentStatus === null ||
			booking.tripStartsAtSnapshot === null ||
			booking.tripEndsAtSnapshot === null ||
			booking.basePrice === null ||
			booking.totalAmount === null
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
			totalAmount: booking.totalAmount,
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

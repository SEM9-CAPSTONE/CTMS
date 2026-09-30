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
import { DataSource, type EntityManager, In } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { EquipmentCatalogStatus } from "../equipment-catalog/equipment-catalog-status.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import {
	type Booking,
	BookingPaymentStatus,
	BookingStatus,
} from "../profiles/entities/booking.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { HealthProfileRepository } from "../profiles/repositories/health-profile.repository";
import {
	TrekkingRoute,
	TrekkingRouteStatus,
} from "../trekking-routes/entities/trekking-route.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { type LockedTripForBooking, TripsRepository } from "../trips/repositories/trips.repository";
import { User, UserStatus } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { WeatherRiskRepository } from "../weather/repositories/weather-risk.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import { BookingItemType } from "./booking-item-type.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingItemsRepository } from "./booking-items.repository";
import { BookingMemberStatus } from "./booking-member-status.enum";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingMembersRepository } from "./booking-members.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { BookingsRepository } from "./bookings.repository";
import type { AddBookingItemResponseDto } from "./dto/add-booking-item-response.dto";
import type { AddBookingItemDto } from "./dto/add-booking-item.dto";
import type { BookingDetailsResponseDto } from "./dto/booking-details-response.dto";
import type { BookingItemResponseDto } from "./dto/booking-item-response.dto";
import type { BookingListItemResponseDto } from "./dto/booking-list-item-response.dto";
import type { BookingResponseDto } from "./dto/booking-response.dto";
import type { CreateBookingDto } from "./dto/create-booking.dto";
import type { InitializeBookingMembersResponseDto } from "./dto/initialize-booking-members-response.dto";
import type { InitializeBookingMembersDto } from "./dto/initialize-booking-members.dto";
import type { PackingListResponseDto } from "./dto/packing-list-response.dto";
import type {
	ResolveBookingMemberCandidateDto,
	ResolveBookingMemberCandidateResponseDto,
} from "./dto/resolve-booking-member-candidate.dto";
import type { BookingItem } from "./entities/booking-item.entity";
import type { BookingMember } from "./entities/booking-member.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EquipmentReservationsRepository } from "./equipment-reservations.repository";
import {
	type HealthProfileInput,
	type PackingListContext,
	type RentedEquipmentInput,
	buildPackingListItems,
} from "./packing-list-builder";

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
		private readonly bookingMembersRepository: BookingMembersRepository,
		private readonly equipmentCatalogRepository: EquipmentCatalogRepository,
		private readonly equipmentReservationsRepository: EquipmentReservationsRepository,
		private readonly weatherRiskRepository: WeatherRiskRepository,
		private readonly healthProfileRepository: HealthProfileRepository
	) {}

	listForOwner(actorId: string): Promise<BookingListItemResponseDto[]> {
		return this.bookingsRepository.findListByOwner(actorId);
	}

	async getBookingDetails(actorId: string, bookingId: string): Promise<BookingDetailsResponseDto> {
		const ownership = await this.bookingsRepository.findOwnershipById(bookingId);
		if (!ownership) throw new NotFoundException("Booking not found");
		if (ownership.userId !== actorId) {
			throw new ForbiddenException("Only the Booking owner can view Booking details");
		}

		const details = await this.bookingsRepository.findDetailsByIdForOwner(bookingId, actorId);
		if (!details) throw new NotFoundException("Booking not found");
		return details;
	}

	/**
	 * CTMS-042-T01. Computed on demand, never persisted -- the spec asks for
	 * "a stable, explainable result for the same authoritative inputs", not
	 * a stored/editable record, so there is no state to transition or audit.
	 * Reuses `findDetailsByIdForOwner` (CTMS-030) verbatim for ownership,
	 * members, and rented equipment instead of re-querying them.
	 */
	async getPackingList(actorId: string, bookingId: string): Promise<PackingListResponseDto> {
		const ownership = await this.bookingsRepository.findOwnershipById(bookingId);
		if (!ownership) throw new NotFoundException("Booking not found");
		if (ownership.userId !== actorId) {
			throw new ForbiddenException("Only the Booking owner can view the packing list");
		}

		const details = await this.bookingsRepository.findDetailsByIdForOwner(bookingId, actorId);
		if (!details) throw new NotFoundException("Booking not found");
		if (!details.tripPresentation || !details.tripStartsAtSnapshot || !details.tripEndsAtSnapshot) {
			throw new ConflictException(
				"Trip context is no longer available for a packing list on this Booking"
			);
		}

		const durationNights = Math.max(
			Math.round(
				(details.tripEndsAtSnapshot.getTime() - details.tripStartsAtSnapshot.getTime()) /
					MILLISECONDS_PER_DAY
			),
			0
		);
		const tripType: "day_trip" | "overnight" = durationNights > 0 ? "overnight" : "day_trip";

		const route = await this.dataSource.getRepository(TrekkingRoute).findOne({
			where: { id: details.tripPresentation.routeId },
			select: { id: true, difficulty: true },
		});

		const assessment = await this.weatherRiskRepository.findLatestAssessmentForRoute(
			details.tripPresentation.routeId
		);

		const rentedEquipmentIds = [
			...new Set(
				details.equipmentItems.map((equipmentItem) => equipmentItem.equipmentCatalogItemId)
			),
		];
		const rentedCatalogItems =
			rentedEquipmentIds.length > 0
				? await this.equipmentCatalogRepository.find({ where: { id: In(rentedEquipmentIds) } })
				: [];
		const rentedEquipment: RentedEquipmentInput[] = details.equipmentItems.map((equipmentItem) => {
			const catalogItem = rentedCatalogItems.find(
				(candidate) => candidate.id === equipmentItem.equipmentCatalogItemId
			);
			return {
				name: catalogItem?.name ?? equipmentItem.presentation?.currentName ?? "Thiết bị đã thuê",
				category: catalogItem?.category ?? "",
				quantity: equipmentItem.quantity,
			};
		});

		const healthProfile = await this.healthProfileRepository.findByUserId(actorId);
		const health: HealthProfileInput | null = healthProfile
			? {
					isConsentGranted: healthProfile.isConsentGranted,
					allergies: healthProfile.allergies,
					medicalConditions: healthProfile.medicalConditions,
					dietaryRestrictions: healthProfile.dietaryRestrictions,
				}
			: null;

		const context: PackingListContext = {
			durationNights,
			tripType,
			difficulty: route?.difficulty ?? null,
			memberCount: Math.max(details.members.length, 1),
			weatherRiskLevel: assessment?.riskLevel ?? null,
			weatherCriteria: assessment?.criteriaScores ?? null,
		};

		return {
			bookingId: details.id,
			tripId: details.tripId,
			context,
			items: buildPackingListItems(context, rentedEquipment, health),
		};
	}

	async resolveMemberCandidate(
		actorId: string,
		bookingId: string,
		dto: ResolveBookingMemberCandidateDto
	): Promise<ResolveBookingMemberCandidateResponseDto> {
		const booking = await this.bookingsRepository.findOne({ where: { id: bookingId } });
		if (!booking) throw new NotFoundException("Booking not found");
		if (booking.userId !== actorId) {
			throw new ForbiddenException("Only the Booking owner can resolve participants");
		}
		this.assertBookingEligibleForRoster(booking);
		if (booking.numPeople === 1) {
			throw new ConflictException("Booking does not require additional participants");
		}
		if (await this.bookingMembersRepository.hasInitialization(bookingId)) {
			throw new ConflictException("Booking member roster is already initialized");
		}
		if ((await this.bookingMembersRepository.findByBooking(bookingId)).length > 0) {
			throw new ConflictException("Booking already has member rows");
		}

		const trip = await this.dataSource.getRepository(Trip).findOne({
			where: { id: booking.tripId },
			select: { id: true, startsAt: true },
		});
		if (!trip) throw new NotFoundException("Trip not found");
		if (trip.startsAt <= new Date()) throw new ConflictException("Trip has already started");

		const candidate = await this.dataSource.getRepository(User).findOne({
			where: { email: dto.email, status: UserStatus.ACTIVE },
			select: { id: true, email: true },
		});
		if (!candidate?.email) throw new NotFoundException("Eligible participant not found");
		if (candidate.id === booking.userId) {
			throw new ConflictException("The Booking owner is added automatically");
		}

		return { userId: candidate.id, email: candidate.email };
	}

	async initializeMembers(
		actorId: string,
		bookingId: string,
		idempotencyKey: string | undefined,
		dto: InitializeBookingMembersDto
	): Promise<InitializeBookingMembersResponseDto> {
		const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
		const requestFingerprint = this.fingerprintMembers(bookingId, dto);

		return this.dataSource.transaction(async (manager: EntityManager) => {
			const membersRepository = manager.withRepository(this.bookingMembersRepository);
			await membersRepository.lockIdempotencyKey(bookingId, actorId, normalizedKey);

			const replay = await membersRepository.findInitializationByKey(
				bookingId,
				actorId,
				normalizedKey
			);
			if (replay) {
				if (replay.requestFingerprint !== requestFingerprint) {
					throw new ConflictException("Idempotency-Key was already used with a different payload");
				}
				return this.toMembersResponse(bookingId, await membersRepository.findByBooking(bookingId));
			}

			const bookingRepository = manager.withRepository(this.bookingsRepository);
			const booking = await bookingRepository.findForUpdate(bookingId);
			if (!booking) throw new NotFoundException("Booking not found");
			if (booking.userId !== actorId) {
				throw new ForbiddenException("Only the Booking owner can initialize members");
			}
			this.assertBookingEligibleForRoster(booking);

			if (await membersRepository.hasInitialization(bookingId)) {
				throw new ConflictException("Booking member roster is already initialized");
			}
			if ((await membersRepository.findByBooking(bookingId)).length > 0) {
				throw new ConflictException("Booking already has member rows");
			}

			const trip = await manager.getRepository(Trip).findOne({
				where: { id: booking.tripId },
				select: { id: true, startsAt: true, capacityMax: true, seatsTaken: true },
			});
			if (!trip) throw new NotFoundException("Trip not found");
			if (trip.startsAt <= new Date()) throw new ConflictException("Trip has already started");
			this.assertBookingCapacityConsistent(booking.numPeople, trip.capacityMax, trip.seatsTaken);

			const requestedUserIds = dto.members.map((member) => member.userId);
			const uniqueRequestedUserIds = new Set(requestedUserIds);
			if (uniqueRequestedUserIds.size !== requestedUserIds.length) {
				throw new ConflictException("A participant cannot appear more than once in a Booking");
			}
			if (uniqueRequestedUserIds.has(booking.userId)) {
				throw new ConflictException(
					"The Booking owner is added automatically and cannot be repeated"
				);
			}
			if (requestedUserIds.length !== booking.numPeople - 1) {
				throw new ConflictException(
					`Roster must contain exactly ${booking.numPeople - 1} additional participant(s)`
				);
			}

			const users = await manager.getRepository(User).find({
				where: { id: In(requestedUserIds) },
				select: { id: true },
			});
			if (users.length !== requestedUserIds.length) {
				throw new NotFoundException("One or more participant users were not found");
			}

			const memberEntities = [
				membersRepository.create({
					bookingId,
					userId: booking.userId,
					isPrimary: true,
					memberStatus: BookingMemberStatus.REGISTERED,
				}),
				...requestedUserIds.map((userId) =>
					membersRepository.create({
						bookingId,
						userId,
						isPrimary: false,
						memberStatus: BookingMemberStatus.REGISTERED,
					})
				),
			];
			const savedMembers = await membersRepository.save(memberEntities);

			await manager.getRepository(AuditLog).save({
				actorId,
				action: "booking.members_initialized",
				targetType: "booking",
				targetId: bookingId,
				before: null,
				after: {
					bookingId,
					memberIds: savedMembers.map((member) => member.id),
					primaryMemberId: savedMembers[0].id,
					effectiveMemberCount: savedMembers.length,
					memberStatus: BookingMemberStatus.REGISTERED,
				},
				reason: "camper_initialize_booking_members",
			});
			await membersRepository.saveInitialization({
				bookingId,
				actorId,
				idempotencyKey: normalizedKey,
				requestFingerprint,
			});

			return this.toMembersResponse(bookingId, savedMembers);
		});
	}

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

			if (booking.basePrice === null) throw new Error("Booking is missing its base price");
			// Equipment rental fee is not added to the trip booking totalAmount
			// It is recorded for host inventory and user reference only.
			booking.totalAmount = booking.basePrice;
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

	private fingerprintMembers(bookingId: string, dto: InitializeBookingMembersDto): string {
		return createHash("sha256")
			.update(
				JSON.stringify({
					bookingId,
					memberUserIds: dto.members.map((member) => member.userId).sort(),
				})
			)
			.digest("hex");
	}

	private assertBookingEligibleForRoster(booking: Booking): asserts booking is Booking & {
		numPeople: number;
		status: BookingStatus.PENDING_PAYMENT | BookingStatus.CONFIRMED;
	} {
		if (
			booking.numPeople === null ||
			booking.numPeople < 1 ||
			(booking.status !== BookingStatus.PENDING_PAYMENT &&
				booking.status !== BookingStatus.CONFIRMED)
		) {
			throw new ConflictException("Booking is not eligible for member initialization");
		}
	}

	private assertBookingCapacityConsistent(
		numPeople: number,
		capacityMax: number | null,
		seatsTaken: number
	): void {
		if (
			seatsTaken < numPeople ||
			(capacityMax !== null && (numPeople > capacityMax || seatsTaken > capacityMax))
		) {
			throw new ConflictException("Booking seat reservation is inconsistent with Trip capacity");
		}
	}

	private toMembersResponse(
		bookingId: string,
		members: BookingMember[]
	): InitializeBookingMembersResponseDto {
		return {
			bookingId,
			members: members.map((member) => ({
				id: member.id,
				userId: member.userId,
				isPrimary: member.isPrimary,
				memberStatus: member.memberStatus,
				createdAt: member.createdAt,
				updatedAt: member.updatedAt,
			})),
		};
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

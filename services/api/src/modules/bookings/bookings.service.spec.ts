import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource, EntityManager } from "typeorm";
import { EquipmentCatalogStatus } from "../equipment-catalog/equipment-catalog-status.enum";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import type { BookingItemsRepository } from "./booking-items.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import { BookingItem } from "./entities/booking-item.entity";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const HOST_ID = "55555555-5555-4555-8555-555555555555";
const EQUIPMENT_ID = "66666666-6666-4666-8666-666666666666";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const STARTS_AT = new Date("2030-10-10T01:00:00.000Z");
const ENDS_AT = new Date("2030-10-10T10:00:00.000Z");

function lockedTrip(overrides: Record<string, unknown> = {}) {
	return {
		id: TRIP_ID,
		routeId: ROUTE_ID,
		routeStatus: TrekkingRouteStatus.ACTIVE,
		capacityMin: 1,
		capacityMax: 10,
		seatsTaken: 2,
		status: TripStatus.PUBLISHED,
		bookingDeadline: new Date("2030-10-09T01:00:00.000Z"),
		startsAt: STARTS_AT,
		endsAt: ENDS_AT,
		pricePerPerson: "500000.00",
		cancellationPolicy: { refundHours: 48 },
		...overrides,
	};
}

function confirmedBooking(overrides: Record<string, unknown> = {}): Booking {
	return Object.assign(new Booking(), {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: USER_ID,
		numPeople: 2,
		status: BookingStatus.CONFIRMED,
		paymentStatus: BookingPaymentStatus.NOT_REQUIRED,
		holdExpiresAt: null,
		tripStartsAtSnapshot: STARTS_AT,
		tripEndsAtSnapshot: ENDS_AT,
		basePrice: "0.00",
		totalAmount: "0.00",
		cancellationPolicySnapshot: null,
		...overrides,
	});
}

function activeEquipment(overrides: Record<string, unknown> = {}) {
	return {
		id: EQUIPMENT_ID,
		hostId: HOST_ID,
		name: "4-person tent",
		category: "shelter",
		quantityTotal: 5,
		rentalPricePerDay: 50000,
		status: EquipmentCatalogStatus.ACTIVE,
		maintenanceSchedule: null,
		...overrides,
	};
}

describe("BookingsService", () => {
	let bookingRepository: {
		lockIdempotencyKey: jest.Mock;
		findByIdempotencyKey: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		findOneBy: jest.Mock;
		findForUpdate: jest.Mock;
	};
	let tripRepository: { findByIdForBooking: jest.Mock; adjustSeatsTaken: jest.Mock };
	let bookingItemsRepository: {
		lockIdempotencyKey: jest.Mock;
		findByIdempotencyKey: jest.Mock;
		findByBooking: jest.Mock;
		sumTotalPriceForBooking: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let equipmentCatalogRepository: { findForUpdate: jest.Mock };
	let equipmentReservationsRepository: {
		sumOverlappingQuantity: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let tripEntityRepository: { findOne: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let weatherService: { assertBookingWeatherAllowed: jest.Mock };
	let service: BookingsService;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date("2029-09-01T00:00:00.000Z"));
		bookingRepository = {
			lockIdempotencyKey: jest.fn().mockResolvedValue(undefined),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
			create: jest.fn((value) => Object.assign(new Booking(), value)),
			save: jest.fn(async (value: Booking) => Object.assign(value, { id: "booking-1" })),
			findOneBy: jest.fn().mockResolvedValue(confirmedBooking()),
			findForUpdate: jest.fn().mockResolvedValue(confirmedBooking()),
		};
		tripRepository = {
			findByIdForBooking: jest.fn().mockResolvedValue(lockedTrip()),
			adjustSeatsTaken: jest.fn().mockResolvedValue(undefined),
		};
		bookingItemsRepository = {
			lockIdempotencyKey: jest.fn().mockResolvedValue(undefined),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
			findByBooking: jest.fn().mockResolvedValue([]),
			sumTotalPriceForBooking: jest.fn().mockResolvedValue("150000.00"),
			create: jest.fn((value) => Object.assign(new BookingItem(), value)),
			save: jest.fn(async (value: BookingItem) => Object.assign(value, { id: "item-1" })),
		};
		equipmentCatalogRepository = {
			findForUpdate: jest.fn().mockResolvedValue(activeEquipment()),
		};
		equipmentReservationsRepository = {
			sumOverlappingQuantity: jest.fn().mockResolvedValue(0),
			create: jest.fn((value) => value),
			save: jest.fn(async (value) => value),
		};
		tripEntityRepository = {
			findOne: jest.fn().mockResolvedValue({ id: TRIP_ID, hostId: HOST_ID }),
		};
		auditRepository = { save: jest.fn().mockResolvedValue(undefined) };
		weatherService = {
			assertBookingWeatherAllowed: jest.fn().mockResolvedValue({ allowed: true }),
		};
		const repositoryByInstance = new Map<object, object>([
			[bookingRepository as object, bookingRepository],
			[tripRepository as object, tripRepository],
			[bookingItemsRepository as object, bookingItemsRepository],
			[equipmentCatalogRepository as object, equipmentCatalogRepository],
			[equipmentReservationsRepository as object, equipmentReservationsRepository],
		]);
		const manager = {
			withRepository: jest.fn((repository: object) => repositoryByInstance.get(repository)),
			getRepository: jest.fn((entityClass: unknown) =>
				entityClass === Trip ? tripEntityRepository : auditRepository
			),
		} as unknown as EntityManager;
		const dataSource = {
			transaction: jest.fn(async (callback: (value: EntityManager) => unknown) =>
				callback(manager)
			),
		} as unknown as DataSource;
		const configService = {
			get: jest.fn((key: string) => (key === "BOOKING_HOLD_TTL_MINUTES" ? "15" : undefined)),
		} as unknown as ConfigService;
		service = new BookingsService(
			bookingRepository as unknown as BookingsRepository,
			tripRepository as unknown as TripsRepository,
			weatherService as unknown as RouteRegistrationRiskService,
			dataSource,
			configService,
			bookingItemsRepository as unknown as BookingItemsRepository,
			equipmentCatalogRepository as unknown as EquipmentCatalogRepository,
			equipmentReservationsRepository as unknown as EquipmentReservationsRepository
		);
	});

	afterEach(() => jest.useRealTimers());

	it("creates a paid Booking with exact subtotal, snapshots, hold, seats, and audit", async () => {
		const result = await service.create(USER_ID, "attempt-1", { tripId: TRIP_ID, numPeople: 3 });

		expect(result).toMatchObject({
			id: "booking-1",
			basePrice: "1500000.00",
			status: BookingStatus.PENDING_PAYMENT,
			paymentStatus: BookingPaymentStatus.UNPAID,
			tripStartsAtSnapshot: STARTS_AT,
			tripEndsAtSnapshot: ENDS_AT,
		});
		expect(result.holdExpiresAt).toEqual(new Date("2029-09-01T00:15:00.000Z"));
		expect(tripRepository.adjustSeatsTaken).toHaveBeenCalledWith(TRIP_ID, 3);
		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ action: "booking.created", targetType: "booking" })
		);
	});

	it("creates a free confirmed Booking without a hold", async () => {
		tripRepository.findByIdForBooking.mockResolvedValue(lockedTrip({ pricePerPerson: "0.00" }));
		const result = await service.create(USER_ID, "attempt-free", { tripId: TRIP_ID, numPeople: 2 });

		expect(result).toMatchObject({
			basePrice: "0.00",
			status: BookingStatus.CONFIRMED,
			paymentStatus: BookingPaymentStatus.NOT_REQUIRED,
			holdExpiresAt: null,
		});
	});

	it.each([
		["0.01", 3, "0.03"],
		["1.10", 2, "2.20"],
		["123456.78", 3, "370370.34"],
		["9999999999.99", 1, "9999999999.99"],
	])("calculates %s x %i exactly as %s", async (pricePerPerson, numPeople, expected) => {
		tripRepository.findByIdForBooking.mockResolvedValue(lockedTrip({ pricePerPerson }));

		const result = await service.create(USER_ID, `money-${pricePerPerson}`, {
			tripId: TRIP_ID,
			numPeople,
		});

		expect(result.basePrice).toBe(expected);
	});

	it("rejects a subtotal above numeric(12,2)", async () => {
		tripRepository.findByIdForBooking.mockResolvedValue(
			lockedTrip({ pricePerPerson: "9999999999.99" })
		);

		await expect(
			service.create(USER_ID, "money-overflow", { tripId: TRIP_ID, numPeople: 2 })
		).rejects.toBeInstanceOf(ConflictException);
		expect(bookingRepository.save).not.toHaveBeenCalled();
	});

	it("replays the original Booking without locking the Trip, reserving seats, or auditing again", async () => {
		await service.create(USER_ID, "attempt-replay", { tripId: TRIP_ID, numPeople: 2 });
		const saved = bookingRepository.save.mock.results[0].value as Promise<Booking>;
		bookingRepository.findByIdempotencyKey.mockResolvedValue(await saved);
		tripRepository.findByIdForBooking.mockClear();
		tripRepository.adjustSeatsTaken.mockClear();
		auditRepository.save.mockClear();

		const replay = await service.create(USER_ID, "attempt-replay", {
			tripId: TRIP_ID,
			numPeople: 2,
		});

		expect(replay.id).toBe("booking-1");
		expect(tripRepository.findByIdForBooking).not.toHaveBeenCalled();
		expect(tripRepository.adjustSeatsTaken).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("rejects an idempotency-key payload mismatch before Trip mutation", async () => {
		await service.create(USER_ID, "attempt-mismatch", { tripId: TRIP_ID, numPeople: 1 });
		bookingRepository.findByIdempotencyKey.mockResolvedValue(
			await bookingRepository.save.mock.results[0].value
		);
		tripRepository.adjustSeatsTaken.mockClear();

		await expect(
			service.create(USER_ID, "attempt-mismatch", { tripId: TRIP_ID, numPeople: 2 })
		).rejects.toBeInstanceOf(ConflictException);
		expect(tripRepository.adjustSeatsTaken).not.toHaveBeenCalled();
	});

	it("scopes the same literal key by authenticated user", async () => {
		await service.create(USER_ID, "shared-key", { tripId: TRIP_ID, numPeople: 1 });
		await service.create(OTHER_USER_ID, "shared-key", { tripId: TRIP_ID, numPeople: 1 });
		expect(bookingRepository.save).toHaveBeenCalledTimes(2);
	});

	it.each([
		["missing", null, NotFoundException],
		["unpublished", lockedTrip({ status: TripStatus.DRAFT }), ConflictException],
		[
			"deadline passed",
			lockedTrip({ bookingDeadline: new Date("2029-08-31T00:00:00Z") }),
			ConflictException,
		],
		[
			"deadline reached",
			lockedTrip({ bookingDeadline: new Date("2029-09-01T00:00:00Z") }),
			ConflictException,
		],
		["started", lockedTrip({ startsAt: new Date("2029-08-31T00:00:00Z") }), ConflictException],
		[
			"start reached",
			lockedTrip({ startsAt: new Date("2029-09-01T00:00:00Z") }),
			ConflictException,
		],
		["inactive route", lockedTrip({ routeStatus: TrekkingRouteStatus.CLOSED }), ConflictException],
		["over capacity", lockedTrip({ capacityMax: 3, seatsTaken: 2 }), ConflictException],
	])("rejects a %s Trip without writes", async (_name, trip, errorType) => {
		tripRepository.findByIdForBooking.mockResolvedValue(trip);
		await expect(
			service.create(USER_ID, "attempt-invalid-trip", { tripId: TRIP_ID, numPeople: 2 })
		).rejects.toBeInstanceOf(errorType);
		expect(bookingRepository.save).not.toHaveBeenCalled();
		expect(tripRepository.adjustSeatsTaken).not.toHaveBeenCalled();
	});

	it("allows the exact final available seats", async () => {
		tripRepository.findByIdForBooking.mockResolvedValue(
			lockedTrip({ capacityMax: 4, seatsTaken: 2 })
		);
		await service.create(USER_ID, "attempt-final", { tripId: TRIP_ID, numPeople: 2 });
		expect(tripRepository.adjustSeatsTaken).toHaveBeenCalledWith(TRIP_ID, 2);
	});

	it("propagates missing and Red Weather Risk without writes", async () => {
		weatherService.assertBookingWeatherAllowed.mockRejectedValue(
			new ConflictException("weather blocked")
		);
		await expect(
			service.create(USER_ID, "attempt-weather", { tripId: TRIP_ID, numPeople: 1 })
		).rejects.toBeInstanceOf(ConflictException);
		expect(bookingRepository.save).not.toHaveBeenCalled();
		expect(tripRepository.adjustSeatsTaken).not.toHaveBeenCalled();
	});

	it.each([undefined, "", "spaces are invalid", "x".repeat(129)])(
		"rejects malformed Idempotency-Key %p",
		async (key) => {
			await expect(
				service.create(USER_ID, key, { tripId: TRIP_ID, numPeople: 1 })
			).rejects.toBeInstanceOf(UnprocessableEntityException);
		}
	);

	it.each(["0", "-1", "1.5", "not-a-number"])(
		"rejects invalid hold TTL configuration %s",
		async (configuredTtl) => {
			const invalidConfig = {
				get: jest.fn().mockReturnValue(configuredTtl),
			} as unknown as ConfigService;
			const invalidService = new BookingsService(
				bookingRepository as unknown as BookingsRepository,
				tripRepository as unknown as TripsRepository,
				weatherService as unknown as RouteRegistrationRiskService,
				(service as unknown as { dataSource: DataSource }).dataSource,
				invalidConfig,
				{} as unknown as BookingItemsRepository,
				{} as unknown as EquipmentCatalogRepository,
				{} as unknown as EquipmentReservationsRepository
			);
			await expect(
				invalidService.create(USER_ID, "attempt-config", { tripId: TRIP_ID, numPeople: 1 })
			).rejects.toThrow("BOOKING_HOLD_TTL_MINUTES must be a positive integer");
		}
	);

	it.each([
		["Booking insert", () => bookingRepository.save.mockRejectedValue(new Error("insert failed"))],
		[
			"seat update",
			() => tripRepository.adjustSeatsTaken.mockRejectedValue(new Error("seat failed")),
		],
		["audit", () => auditRepository.save.mockRejectedValue(new Error("audit failed"))],
	])("propagates %s failure so the enclosing transaction rolls back", async (_name, arrange) => {
		arrange();
		await expect(
			service.create(USER_ID, `attempt-${_name}`, { tripId: TRIP_ID, numPeople: 1 })
		).rejects.toThrow();
	});

	describe("addItem", () => {
		const addItemDto = { equipmentCatalogItemId: EQUIPMENT_ID, quantity: 2 };

		it("adds an item, snapshots price/rental days, and recalculates the Booking total", async () => {
			const result = await service.addItem(USER_ID, BOOKING_ID, "add-1", addItemDto);

			expect(result.item).toMatchObject({
				id: "item-1",
				bookingId: BOOKING_ID,
				equipmentCatalogItemId: EQUIPMENT_ID,
				quantity: 2,
				unitPrice: "50000.00",
				rentalDays: 1,
				totalPrice: "100000.00",
			});
			expect(result.booking.totalAmount).toBe("150000.00");
			expect(equipmentCatalogRepository.findForUpdate).toHaveBeenCalledWith(EQUIPMENT_ID);
			expect(equipmentReservationsRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					equipmentCatalogItemId: EQUIPMENT_ID,
					quantity: 2,
					rentalStartDate: "2030-10-10",
					rentalEndDate: "2030-10-10",
				})
			);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({ action: "booking_item.added", targetType: "booking_item" })
			);
		});

		it("rejects a caller who is not the Booking owner, with no writes", async () => {
			await expect(
				service.addItem(OTHER_USER_ID, BOOKING_ID, "add-owner", addItemDto)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(bookingItemsRepository.save).not.toHaveBeenCalled();
		});

		it("returns 404 when the Booking does not exist", async () => {
			bookingRepository.findForUpdate.mockResolvedValue(null);
			await expect(
				service.addItem(USER_ID, BOOKING_ID, "add-missing", addItemDto)
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it.each([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.COMPLETED])(
			"rejects adding items to a %s Booking",
			async (status) => {
				bookingRepository.findForUpdate.mockResolvedValue(confirmedBooking({ status }));
				await expect(
					service.addItem(USER_ID, BOOKING_ID, `add-${status}`, addItemDto)
				).rejects.toBeInstanceOf(ConflictException);
				expect(bookingItemsRepository.save).not.toHaveBeenCalled();
			}
		);

		it("returns 404 when the Equipment catalog item does not exist", async () => {
			equipmentCatalogRepository.findForUpdate.mockResolvedValue(null);
			await expect(
				service.addItem(USER_ID, BOOKING_ID, "add-no-equip", addItemDto)
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it.each([EquipmentCatalogStatus.INACTIVE, EquipmentCatalogStatus.RETIRED])(
			"rejects %s equipment with no writes",
			async (status) => {
				equipmentCatalogRepository.findForUpdate.mockResolvedValue(activeEquipment({ status }));
				await expect(
					service.addItem(USER_ID, BOOKING_ID, `add-${status}`, addItemDto)
				).rejects.toBeInstanceOf(UnprocessableEntityException);
				expect(bookingItemsRepository.save).not.toHaveBeenCalled();
			}
		);

		it("rejects equipment that belongs to a different Host than the Trip", async () => {
			tripEntityRepository.findOne.mockResolvedValue({ id: TRIP_ID, hostId: "a-different-host" });
			await expect(
				service.addItem(USER_ID, BOOKING_ID, "add-wrong-host", addItemDto)
			).rejects.toBeInstanceOf(UnprocessableEntityException);
			expect(bookingItemsRepository.save).not.toHaveBeenCalled();
		});

		it("rejects a quantity that would exceed the remaining availability", async () => {
			equipmentReservationsRepository.sumOverlappingQuantity.mockResolvedValue(4);
			await expect(
				service.addItem(USER_ID, BOOKING_ID, "add-oversell", { ...addItemDto, quantity: 2 })
			).rejects.toBeInstanceOf(ConflictException);
			expect(bookingItemsRepository.save).not.toHaveBeenCalled();
		});

		it("allows exactly the remaining availability", async () => {
			equipmentReservationsRepository.sumOverlappingQuantity.mockResolvedValue(3);
			await expect(
				service.addItem(USER_ID, BOOKING_ID, "add-exact", { ...addItemDto, quantity: 2 })
			).resolves.toBeDefined();
		});

		it("replays the original item and Booking without creating a second item", async () => {
			await service.addItem(USER_ID, BOOKING_ID, "add-replay", addItemDto);
			const savedItem = bookingItemsRepository.save.mock.results[0].value as Promise<BookingItem>;
			bookingItemsRepository.findByIdempotencyKey.mockResolvedValue(await savedItem);
			equipmentCatalogRepository.findForUpdate.mockClear();

			const replay = await service.addItem(USER_ID, BOOKING_ID, "add-replay", addItemDto);

			expect(replay.item.id).toBe("item-1");
			expect(equipmentCatalogRepository.findForUpdate).not.toHaveBeenCalled();
			expect(bookingItemsRepository.save).toHaveBeenCalledTimes(1);
		});

		it("rejects an Idempotency-Key reused with a different payload", async () => {
			await service.addItem(USER_ID, BOOKING_ID, "add-mismatch", addItemDto);
			bookingItemsRepository.findByIdempotencyKey.mockResolvedValue(
				await bookingItemsRepository.save.mock.results[0].value
			);

			await expect(
				service.addItem(USER_ID, BOOKING_ID, "add-mismatch", { ...addItemDto, quantity: 3 })
			).rejects.toBeInstanceOf(ConflictException);
		});
	});

	describe("listItems", () => {
		it("returns the Booking owner's items", async () => {
			bookingItemsRepository.findByBooking.mockResolvedValue([
				Object.assign(new BookingItem(), {
					id: "item-1",
					bookingId: BOOKING_ID,
					itemType: "equipment",
					equipmentCatalogItemId: EQUIPMENT_ID,
					quantity: 2,
					unitPrice: "50000.00",
					rentalDays: 1,
					totalPrice: "100000.00",
					createdAt: new Date("2029-09-01T00:00:00.000Z"),
				}),
			]);

			const result = await service.listItems(USER_ID, BOOKING_ID);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({ id: "item-1", totalPrice: "100000.00" });
		});

		it("rejects a caller who is not the Booking owner", async () => {
			await expect(service.listItems(OTHER_USER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it("returns 404 when the Booking does not exist", async () => {
			bookingRepository.findOneBy.mockResolvedValue(null);
			await expect(service.listItems(USER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});
});

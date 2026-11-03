import type { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { HealthProfileRepository } from "../profiles/repositories/health-profile.repository";
import type { EventsGateway, TripAvailabilityUpdatedPayload } from "../realtime/events.gateway";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { Trip, TripStatus } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import type { WeatherRiskRepository } from "../weather/repositories/weather-risk.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import { BookingCancellationService } from "./booking-cancellation.service";
import { BookingExpiryService } from "./booking-expiry.service";
import type { BookingItemsRepository } from "./booking-items.repository";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";
import type { PaymentsRepository } from "./payments.repository";

describe("Trip Availability Realtime Updates (CTMS-83)", () => {
	const tripId = "trip-test-uuid";
	const bookingId = "booking-test-uuid";
	const userId = "user-test-uuid";

	let emitSpy: jest.Mock;
	let mockEventsGateway: { emitTripAvailabilityUpdated: jest.Mock };

	beforeEach(() => {
		emitSpy = jest.fn();
		mockEventsGateway = {
			emitTripAvailabilityUpdated: emitSpy,
		};
	});

	it("PB AC-1, AC-2, AC-3: BookingsService.create emits updated seats_taken and remainingSeats", async () => {
		const mockTrip = {
			id: tripId,
			hostId: "host-1",
			status: TripStatus.PUBLISHED,
			startsAt: new Date(Date.now() + 86400000),
			capacityMax: 10,
			seatsTaken: 6,
			pricePerPerson: "100.00",
			cancellationPolicy: null,
			routeStatus: TrekkingRouteStatus.ACTIVE,
		};

		const mockBookingsRepo = {
			lockIdempotencyKey: jest.fn().mockResolvedValue(undefined),
			findByIdempotencyKey: jest.fn().mockResolvedValue(null),
			create: jest
				.fn()
				.mockImplementation((val: Record<string, unknown>) => ({ id: bookingId, ...val })),
			save: jest
				.fn()
				.mockImplementation((val: Record<string, unknown>) =>
					Promise.resolve({ id: bookingId, ...val })
				),
		};

		const mockTripsRepo = {
			findByIdForBooking: jest.fn().mockResolvedValue(mockTrip),
			adjustSeatsTaken: jest.fn().mockResolvedValue(undefined),
		};

		const mockWeatherService = {
			assertBookingWeatherAllowed: jest.fn().mockResolvedValue(undefined),
		};

		const mockDataSource = {
			transaction: jest.fn().mockImplementation(async (cb: (mgr: unknown) => Promise<unknown>) => {
				const mockManager = {
					withRepository: (repo: unknown) => repo,
					getRepository: () => ({
						save: jest.fn().mockResolvedValue({}),
					}),
				};
				return cb(mockManager);
			}),
		};

		const mockConfigService = {
			get: jest.fn().mockReturnValue(120),
		};

		const service = new BookingsService(
			mockBookingsRepo as unknown as BookingsRepository,
			mockTripsRepo as unknown as TripsRepository,
			mockWeatherService as unknown as RouteRegistrationRiskService,
			mockDataSource as unknown as DataSource,
			mockConfigService as unknown as ConfigService,
			{} as unknown as BookingItemsRepository,
			{} as unknown as BookingMembersRepository,
			{} as unknown as EquipmentCatalogRepository,
			{} as unknown as EquipmentReservationsRepository,
			{} as unknown as WeatherRiskRepository,
			{} as unknown as HealthProfileRepository,
			undefined,
			mockEventsGateway as unknown as EventsGateway
		);

		await service.create(userId, "idemp-key-123", {
			tripId,
			numPeople: 2,
		});

		expect(emitSpy).toHaveBeenCalledTimes(1);
		const emitted: TripAvailabilityUpdatedPayload = emitSpy.mock.calls[0][0];
		expect(emitted.tripId).toBe(tripId);
		expect(emitted.seatsTaken).toBe(8); // 6 + 2
		expect(emitted.capacityMax).toBe(10);
		expect(emitted.remainingSeats).toBe(2); // 10 - 8
		expect(typeof emitted.eventId).toBe("string");
		expect(emitted.eventId.length).toBeGreaterThan(0);
		expect(typeof emitted.updatedAt).toBe("string");
	});

	it("PB AC-1, AC-2, AC-3: BookingCancellationService.cancel emits updated seats_taken and remainingSeats", async () => {
		const tripStartsAt = new Date(Date.now() + 86400000);
		const mockTrip = {
			id: tripId,
			title: "Trip Test",
			hostId: "host-1",
			status: TripStatus.PUBLISHED,
			startsAt: tripStartsAt,
			capacityMax: 10,
			seatsTaken: 8,
			cancellationPolicy: {
				rules: [{ daysBeforeDeparture: 1, refundPercent: 100 }],
			},
		};

		const mockBooking = {
			id: bookingId,
			userId,
			tripId,
			numPeople: 2,
			status: BookingStatus.CONFIRMED,
			paymentStatus: BookingPaymentStatus.PAID,
			basePrice: "200.00",
			totalAmount: "200.00",
			tripStartsAtSnapshot: tripStartsAt,
			cancellationPolicySnapshot: {
				version: 1,
				rules: [{ minHoursBeforeTrip: 0, refundPercent: 50 }],
			},
			createdAt: new Date(),
		};

		const mockBookingsRepo = {
			findOne: jest.fn().mockResolvedValue({ id: bookingId, tripId }),
			findForUpdate: jest.fn().mockResolvedValue(mockBooking),
			save: jest.fn().mockResolvedValue(mockBooking),
		};

		const mockTripsRepo = {
			findByIdForBooking: jest.fn().mockResolvedValue(mockTrip),
			adjustSeatsTaken: jest.fn().mockResolvedValue(undefined),
		};

		const mockPaymentsRepo = {
			findByBookingForUpdate: jest.fn().mockResolvedValue([
				{
					id: "pay-1",
					bookingId,
					type: "charge",
					status: "succeeded",
					amount: "200.00",
				},
			]),
			create: jest.fn().mockImplementation((val: Record<string, unknown>) => val),
			save: jest.fn().mockResolvedValue({ id: "refund-1", amount: "200.00" }),
		};

		const mockEquipmentRepo = {
			findByBookingForUpdate: jest.fn().mockResolvedValue([]),
		};

		const mockDataSource = {
			transaction: jest.fn().mockImplementation(async (cb: (mgr: unknown) => Promise<unknown>) => {
				const mockManager = {
					withRepository: (repo: unknown) => {
						if (repo === mockBookingsRepo) return mockBookingsRepo;
						if (repo === mockTripsRepo) return mockTripsRepo;
						if (repo === mockPaymentsRepo) return mockPaymentsRepo;
						if (repo === mockEquipmentRepo) return mockEquipmentRepo;
						return repo;
					},
					getRepository: (entity: unknown) => {
						if (entity === Trip) {
							return {
								findOne: jest.fn().mockResolvedValue(mockTrip),
							};
						}
						return {
							save: jest.fn().mockResolvedValue({}),
						};
					},
					query: jest.fn().mockResolvedValue([]),
				};
				return cb(mockManager);
			}),
		};

		const service = new BookingCancellationService(
			mockDataSource as unknown as DataSource,
			mockBookingsRepo as unknown as BookingsRepository,
			mockTripsRepo as unknown as TripsRepository,
			mockPaymentsRepo as unknown as PaymentsRepository,
			mockEquipmentRepo as unknown as EquipmentReservationsRepository,
			mockEventsGateway as unknown as EventsGateway
		);

		await service.cancel(userId, bookingId, { reason: "Change of plans" });

		expect(emitSpy).toHaveBeenCalledTimes(1);
		const emitted: TripAvailabilityUpdatedPayload = emitSpy.mock.calls[0][0];
		expect(emitted.tripId).toBe(tripId);
		expect(emitted.seatsTaken).toBe(6); // 8 - 2
		expect(emitted.capacityMax).toBe(10);
		expect(emitted.remainingSeats).toBe(4); // 10 - 6
		expect(typeof emitted.eventId).toBe("string");
		expect(typeof emitted.updatedAt).toBe("string");
	});

	it("PB AC-1, AC-2, AC-3: BookingExpiryService.expireBooking emits updated seats_taken and remainingSeats", async () => {
		const mockTrip = {
			id: tripId,
			capacityMax: 10,
			seatsTaken: 5,
		};

		const mockBooking = {
			id: bookingId,
			userId,
			tripId,
			numPeople: 3,
			status: BookingStatus.PENDING_PAYMENT,
			paymentStatus: BookingPaymentStatus.UNPAID,
			holdExpiresAt: new Date(Date.now() - 1000),
		};

		const mockBookingsRepo = {
			findOne: jest.fn().mockResolvedValue({ id: bookingId, tripId }),
			findForUpdate: jest.fn().mockResolvedValue(mockBooking),
			save: jest.fn().mockResolvedValue(mockBooking),
		};

		const mockTripsRepo = {
			adjustSeatsTaken: jest.fn().mockResolvedValue(undefined),
		};

		const mockPaymentsRepo = {
			findByBookingForUpdate: jest.fn().mockResolvedValue([]),
		};

		const mockEquipmentRepo = {
			findByBookingForUpdate: jest.fn().mockResolvedValue([]),
		};

		const mockDataSource = {
			transaction: jest.fn().mockImplementation(async (cb: (mgr: unknown) => Promise<unknown>) => {
				const mockManager = {
					query: jest.fn().mockResolvedValue([{ evaluatedAt: new Date() }]),
					withRepository: (repo: unknown) => repo,
					getRepository: (entity: unknown) => {
						if (entity === Trip) {
							return {
								findOne: jest.fn().mockResolvedValue(mockTrip),
							};
						}
						return {
							save: jest.fn().mockResolvedValue({}),
						};
					},
				};
				return cb(mockManager);
			}),
		};

		const service = new BookingExpiryService(
			mockDataSource as unknown as DataSource,
			mockBookingsRepo as unknown as BookingsRepository,
			mockTripsRepo as unknown as TripsRepository,
			mockPaymentsRepo as unknown as PaymentsRepository,
			mockEquipmentRepo as unknown as EquipmentReservationsRepository,
			mockEventsGateway as unknown as EventsGateway
		);

		await service.expireBooking(bookingId);

		expect(emitSpy).toHaveBeenCalledTimes(1);
		const emitted: TripAvailabilityUpdatedPayload = emitSpy.mock.calls[0][0];
		expect(emitted.tripId).toBe(tripId);
		expect(emitted.seatsTaken).toBe(2); // 5 - 3
		expect(emitted.capacityMax).toBe(10);
		expect(emitted.remainingSeats).toBe(8); // 10 - 2
		expect(typeof emitted.eventId).toBe("string");
		expect(typeof emitted.updatedAt).toBe("string");
	});
});

import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { Booking, BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { HealthProfileRepository } from "../profiles/repositories/health-profile.repository";
import { Trip } from "../trips/entities/trip.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import { User, UserRole, UserStatus } from "../users/entities/user.entity";
import type { WeatherRiskRepository } from "../weather/repositories/weather-risk.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import type { BookingItemsRepository } from "./booking-items.repository";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "88888888-8888-4888-8888-888888888888";
const NOW = new Date("2029-09-01T00:00:00.000Z");

function booking(overrides: Partial<Booking> = {}): Booking {
	return Object.assign(new Booking(), {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: OWNER_ID,
		numPeople: 2,
		status: BookingStatus.PENDING_PAYMENT,
		paymentStatus: BookingPaymentStatus.UNPAID,
		tripStartsAtSnapshot: new Date("2029-09-02T00:00:00.000Z"),
		...overrides,
	});
}

describe("BookingsService.resolveMemberCandidate", () => {
	let bookingsRepository: { findOne: jest.Mock };
	let membersRepository: { hasInitialization: jest.Mock; findByBooking: jest.Mock };
	let tripRepository: { findOne: jest.Mock };
	let userRepository: { findOne: jest.Mock };
	let service: BookingsService;

	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(NOW);
		bookingsRepository = { findOne: jest.fn().mockResolvedValue(booking()) };
		membersRepository = {
			hasInitialization: jest.fn().mockResolvedValue(false),
			findByBooking: jest.fn().mockResolvedValue([]),
		};
		tripRepository = {
			findOne: jest.fn().mockResolvedValue({ id: TRIP_ID, startsAt: new Date("2029-09-02") }),
		};
		userRepository = {
			findOne: jest.fn().mockResolvedValue({
				id: CANDIDATE_ID,
				email: "participant@example.com",
				status: UserStatus.ACTIVE,
				fullName: "Must not leak",
				phone: "+84912345678",
				role: UserRole.CAMPER,
			}),
		};
		const dataSource = {
			getRepository: jest.fn((entity: unknown) => {
				if (entity === Trip) return tripRepository;
				if (entity === User) return userRepository;
				throw new Error("Unexpected repository");
			}),
		} as unknown as DataSource;
		service = new BookingsService(
			bookingsRepository as unknown as BookingsRepository,
			{} as TripsRepository,
			{} as RouteRegistrationRiskService,
			dataSource,
			{} as ConfigService,
			{} as BookingItemsRepository,
			membersRepository as unknown as BookingMembersRepository,
			{} as EquipmentCatalogRepository,
			{} as EquipmentReservationsRepository,
			{} as WeatherRiskRepository,
			{} as HealthProfileRepository
		);
	});

	afterEach(() => jest.useRealTimers());

	it("returns only the active candidate id and normalized email", async () => {
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "participant@example.com" })
		).resolves.toEqual({ userId: CANDIDATE_ID, email: "participant@example.com" });
		expect(userRepository.findOne).toHaveBeenCalledWith({
			where: { email: "participant@example.com", status: UserStatus.ACTIVE },
			select: { id: true, email: true },
		});
	});

	it("rejects a non-owner before looking up the target", async () => {
		await expect(
			service.resolveMemberCandidate(CANDIDATE_ID, BOOKING_ID, { email: "x@example.com" })
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(userRepository.findOne).not.toHaveBeenCalled();
	});

	it("returns 404 for a missing Booking", async () => {
		bookingsRepository.findOne.mockResolvedValue(null);
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "x@example.com" })
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it.each([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.COMPLETED])(
		"rejects a %s Booking",
		async (status) => {
			bookingsRepository.findOne.mockResolvedValue(booking({ status }));
			await expect(
				service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "x@example.com" })
			).rejects.toBeInstanceOf(ConflictException);
		}
	);

	it("rejects a started Trip", async () => {
		tripRepository.findOne.mockResolvedValue({ id: TRIP_ID, startsAt: NOW });
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "x@example.com" })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("rejects an initialized roster", async () => {
		membersRepository.hasInitialization.mockResolvedValue(true);
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "x@example.com" })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("rejects an owner-only Booking", async () => {
		bookingsRepository.findOne.mockResolvedValue(booking({ numPeople: 1 }));
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "x@example.com" })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("rejects the owner as a candidate", async () => {
		userRepository.findOne.mockResolvedValue({ id: OWNER_ID, email: "owner@example.com" });
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "owner@example.com" })
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("uses the same privacy-safe 404 for every ineligible target", async () => {
		userRepository.findOne.mockResolvedValue(null);
		await expect(
			service.resolveMemberCandidate(OWNER_ID, BOOKING_ID, { email: "missing@example.com" })
		).rejects.toMatchObject({ message: "Eligible participant not found" });
	});
});

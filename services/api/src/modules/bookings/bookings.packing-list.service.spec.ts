import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import { EquipmentCatalogStatus } from "../equipment-catalog/equipment-catalog-status.enum";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { HealthProfileRepository } from "../profiles/repositories/health-profile.repository";
import { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import type { WeatherRiskRepository } from "../weather/repositories/weather-risk.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import { BookingItemType } from "./booking-item-type.enum";
import type { BookingItemsRepository } from "./booking-items.repository";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import type { BookingDetailsResponseDto } from "./dto/booking-details-response.dto";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const EQUIPMENT_ID = "55555555-5555-4555-8555-555555555555";

function details(overrides: Partial<BookingDetailsResponseDto> = {}): BookingDetailsResponseDto {
	return {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: OWNER_ID,
		numPeople: 2,
		status: BookingStatus.CONFIRMED,
		paymentStatus: BookingPaymentStatus.NOT_REQUIRED,
		holdExpiresAt: null,
		tripStartsAtSnapshot: new Date("2030-10-10T00:00:00.000Z"),
		tripEndsAtSnapshot: new Date("2030-10-12T00:00:00.000Z"),
		basePrice: "0.00",
		totalAmount: "0.00",
		cancellationPolicySnapshot: null,
		createdAt: new Date("2029-01-01T00:00:00.000Z"),
		tripPresentation: {
			id: TRIP_ID,
			currentTitle: "Bidoup trek",
			routeId: ROUTE_ID,
			currentRouteName: "Bidoup route",
		},
		members: [
			{
				id: "member-1",
				userId: OWNER_ID,
				email: "owner@example.com",
				isPrimary: true,
				memberStatus: BookingMemberStatus.REGISTERED,
				createdAt: new Date("2029-01-01T00:00:00.000Z"),
				updatedAt: new Date("2029-01-01T00:00:00.000Z"),
			},
		],
		equipmentItems: [],
		...overrides,
	};
}

describe("BookingsService.getPackingList", () => {
	let bookingsRepository: { findOwnershipById: jest.Mock; findDetailsByIdForOwner: jest.Mock };
	let tripRepository: { findOne: jest.Mock };
	let weatherRiskRepository: { findLatestAssessmentForRoute: jest.Mock };
	let healthProfileRepository: { findByUserId: jest.Mock };
	let equipmentCatalogRepository: { find: jest.Mock };
	let service: BookingsService;

	beforeEach(() => {
		bookingsRepository = {
			findOwnershipById: jest.fn().mockResolvedValue({ id: BOOKING_ID, userId: OWNER_ID }),
			findDetailsByIdForOwner: jest.fn().mockResolvedValue(details()),
		};
		tripRepository = {
			findOne: jest
				.fn()
				.mockResolvedValue({ id: ROUTE_ID, difficulty: TrekkingRouteDifficulty.EASY }),
		};
		weatherRiskRepository = { findLatestAssessmentForRoute: jest.fn().mockResolvedValue(null) };
		healthProfileRepository = { findByUserId: jest.fn().mockResolvedValue(null) };
		equipmentCatalogRepository = { find: jest.fn().mockResolvedValue([]) };
		const dataSource = {
			getRepository: jest.fn(() => tripRepository),
		} as unknown as DataSource;

		service = new BookingsService(
			bookingsRepository as unknown as BookingsRepository,
			{} as TripsRepository,
			{} as RouteRegistrationRiskService,
			dataSource,
			{} as ConfigService,
			{} as BookingItemsRepository,
			{} as BookingMembersRepository,
			equipmentCatalogRepository as unknown as EquipmentCatalogRepository,
			{} as EquipmentReservationsRepository,
			weatherRiskRepository as unknown as WeatherRiskRepository,
			healthProfileRepository as unknown as HealthProfileRepository
		);
	});

	it("returns 404 when the Booking does not exist, without loading details", async () => {
		bookingsRepository.findOwnershipById.mockResolvedValue(null);

		await expect(service.getPackingList(OWNER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(bookingsRepository.findDetailsByIdForOwner).not.toHaveBeenCalled();
	});

	it("returns 403 for a caller who does not own the Booking", async () => {
		await expect(service.getPackingList(OTHER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(bookingsRepository.findDetailsByIdForOwner).not.toHaveBeenCalled();
	});

	it("returns 409 when the Trip context is no longer available", async () => {
		bookingsRepository.findDetailsByIdForOwner.mockResolvedValue(
			details({ tripPresentation: null })
		);

		await expect(service.getPackingList(OWNER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
			ConflictException
		);
	});

	it("returns 409 when the Booking is missing its Trip date snapshot", async () => {
		bookingsRepository.findDetailsByIdForOwner.mockResolvedValue(
			details({ tripStartsAtSnapshot: null })
		);

		await expect(service.getPackingList(OWNER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
			ConflictException
		);
	});

	it("computes durationNights/tripType from the Booking's own snapshot and queries the Route by id", async () => {
		const result = await service.getPackingList(OWNER_ID, BOOKING_ID);

		expect(result.context).toMatchObject({
			durationNights: 2,
			tripType: "overnight",
			difficulty: TrekkingRouteDifficulty.EASY,
			memberCount: 1,
			weatherRiskLevel: null,
		});
		expect(tripRepository.findOne).toHaveBeenCalledWith({
			where: { id: ROUTE_ID },
			select: { id: true, difficulty: true },
		});
		expect(weatherRiskRepository.findLatestAssessmentForRoute).toHaveBeenCalledWith(ROUTE_ID);
	});

	it("treats a same-day booking as a day trip with zero nights", async () => {
		bookingsRepository.findDetailsByIdForOwner.mockResolvedValue(
			details({
				tripStartsAtSnapshot: new Date("2030-10-10T01:00:00.000Z"),
				tripEndsAtSnapshot: new Date("2030-10-10T10:00:00.000Z"),
			})
		);

		const result = await service.getPackingList(OWNER_ID, BOOKING_ID);

		expect(result.context).toMatchObject({ durationNights: 0, tripType: "day_trip" });
	});

	it("includes the latest weather risk level and criteria in the context", async () => {
		weatherRiskRepository.findLatestAssessmentForRoute.mockResolvedValue({
			riskLevel: RiskLevel.YELLOW,
			criteriaScores: {
				rainfall: { value: 20, level: RiskLevel.YELLOW, weight: 0.3, score: 1 },
				wind: { value: 10, level: RiskLevel.GREEN, weight: 0.2, score: 0 },
				temperature: { value: 20, level: RiskLevel.GREEN, weight: 0.2, score: 0 },
				visibility: { value: 8000, level: RiskLevel.GREEN, weight: 0.15, score: 0 },
				thunderstorm: { value: false, level: RiskLevel.GREEN, weight: 0.15, score: 0 },
			},
		});

		const result = await service.getPackingList(OWNER_ID, BOOKING_ID);

		expect(result.context.weatherRiskLevel).toBe(RiskLevel.YELLOW);
		expect(result.items.find((packingItem) => packingItem.id === "rain-gear")).toBeDefined();
	});

	it("resolves rented equipment's real name/category from the catalog and marks it already covered", async () => {
		bookingsRepository.findDetailsByIdForOwner.mockResolvedValue(
			details({
				equipmentItems: [
					{
						id: "item-1",
						itemType: BookingItemType.EQUIPMENT,
						equipmentCatalogItemId: EQUIPMENT_ID,
						quantity: 2,
						unitPrice: "50000.00",
						rentalDays: 2,
						totalPrice: "200000.00",
						createdAt: new Date("2029-01-01T00:00:00.000Z"),
						presentation: { currentName: "4-person tent" },
					},
				],
			})
		);
		equipmentCatalogRepository.find.mockResolvedValue([
			{
				id: EQUIPMENT_ID,
				name: "4-person tent",
				category: "shelter",
				status: EquipmentCatalogStatus.ACTIVE,
			},
		]);

		const result = await service.getPackingList(OWNER_ID, BOOKING_ID);

		const tentItem = result.items.find((packingItem) => packingItem.id === "tent");
		expect(tentItem).toMatchObject({ required: false, alreadyCovered: true });
		const rentedItem = result.items.find((packingItem) => packingItem.id.startsWith("rented-"));
		expect(rentedItem?.name).toContain("x2");
	});

	it("does not include health items when no health profile exists", async () => {
		const result = await service.getPackingList(OWNER_ID, BOOKING_ID);
		expect(result.items.some((packingItem) => packingItem.category === "health")).toBe(false);
	});

	it("includes health items only when consent is granted", async () => {
		healthProfileRepository.findByUserId.mockResolvedValue({
			isConsentGranted: true,
			allergies: [{ id: "a1", name: "Peanuts", severity: "HIGH" }],
			medicalConditions: [],
			dietaryRestrictions: null,
		});

		const result = await service.getPackingList(OWNER_ID, BOOKING_ID);

		expect(
			result.items.find((packingItem) => packingItem.id === "allergy-medication")
		).toBeDefined();
	});
});

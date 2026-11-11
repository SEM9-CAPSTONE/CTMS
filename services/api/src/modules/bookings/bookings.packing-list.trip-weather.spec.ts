import type { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import type { EquipmentCatalogRepository } from "../equipment-catalog/equipment-catalog.repository";
import { BookingPaymentStatus, BookingStatus } from "../profiles/entities/booking.entity";
import type { HealthProfileRepository } from "../profiles/repositories/health-profile.repository";
import { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import type { TripsRepository } from "../trips/repositories/trips.repository";
import { TripWeatherForecastStatus } from "../weather/entities/trip-weather-forecast.entity";
import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import type { WeatherRiskRepository } from "../weather/repositories/weather-risk.repository";
import type { RouteRegistrationRiskService } from "../weather/services/route-registration-risk.service";
import type { TripWeatherForecastService } from "../weather/services/trip-weather-forecast.service";
import type { BookingItemsRepository } from "./booking-items.repository";
import { BookingMemberStatus } from "./booking-member-status.enum";
import type { BookingMembersRepository } from "./booking-members.repository";
import type { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import type { BookingDetailsResponseDto } from "./dto/booking-details-response.dto";
import type { EquipmentReservationsRepository } from "./equipment-reservations.repository";

/** The packing list follows the forecast for the Trip's own dates, not today's Route weather. */
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";

const criterion = (level: RiskLevel) => ({ level, score: 0, value: 0 });

function details(): BookingDetailsResponseDto {
	return {
		id: BOOKING_ID,
		tripId: TRIP_ID,
		userId: OWNER_ID,
		numPeople: 1,
		status: BookingStatus.CONFIRMED,
		paymentStatus: BookingPaymentStatus.NOT_REQUIRED,
		holdExpiresAt: null,
		tripStartsAtSnapshot: new Date("2026-11-10T00:00:00.000Z"),
		tripEndsAtSnapshot: new Date("2026-11-10T10:00:00.000Z"),
		basePrice: "0.00",
		totalAmount: "0.00",
		cancellationPolicySnapshot: null,
		createdAt: new Date("2026-11-01T00:00:00.000Z"),
		tripPresentation: {
			id: TRIP_ID,
			currentTitle: "Sơn Trà",
			routeId: ROUTE_ID,
			currentRouteName: "Sơn Trà route",
		},
		members: [
			{
				id: "member-1",
				userId: OWNER_ID,
				email: "owner@example.com",
				isPrimary: true,
				memberStatus: BookingMemberStatus.REGISTERED,
				createdAt: new Date("2026-11-01T00:00:00.000Z"),
				updatedAt: new Date("2026-11-01T00:00:00.000Z"),
			},
		],
		equipmentItems: [],
	} as BookingDetailsResponseDto;
}

function build(tripForecast: unknown) {
	const weatherRiskRepository = {
		findLatestAssessmentForRoute: jest.fn().mockResolvedValue({
			id: "assessment-today",
			riskLevel: RiskLevel.RED,
			criteriaScores: {
				rainfall: criterion(RiskLevel.RED),
				wind: criterion(RiskLevel.RED),
				temperature: criterion(RiskLevel.GREEN),
				visibility: criterion(RiskLevel.GREEN),
				thunderstorm: criterion(RiskLevel.RED),
			},
		}),
	};
	const tripWeatherForecasts = {
		tryEnsureTripForecast: jest.fn().mockResolvedValue(tripForecast),
	};
	const dataSourceQuery = jest
		.fn()
		.mockResolvedValue([{ id: "generation-1", createdAt: new Date("2026-11-07T00:00:00.000Z") }]);
	const dataSource = {
		getRepository: jest.fn(() => ({
			findOne: jest
				.fn()
				.mockResolvedValue({ id: ROUTE_ID, difficulty: TrekkingRouteDifficulty.EASY }),
		})),
		query: dataSourceQuery,
	} as unknown as DataSource;
	const service = new BookingsService(
		{
			findOwnershipById: jest.fn().mockResolvedValue({ id: BOOKING_ID, userId: OWNER_ID }),
			findDetailsByIdForOwner: jest.fn().mockResolvedValue(details()),
		} as unknown as BookingsRepository,
		{} as TripsRepository,
		{} as RouteRegistrationRiskService,
		dataSource,
		{} as ConfigService,
		{} as BookingItemsRepository,
		{} as BookingMembersRepository,
		{ find: jest.fn().mockResolvedValue([]) } as unknown as EquipmentCatalogRepository,
		{} as EquipmentReservationsRepository,
		weatherRiskRepository as unknown as WeatherRiskRepository,
		{ findByUserId: jest.fn().mockResolvedValue(null) } as unknown as HealthProfileRepository,
		undefined,
		undefined,
		tripWeatherForecasts as unknown as TripWeatherForecastService
	);
	return { service, weatherRiskRepository, tripWeatherForecasts, dataSourceQuery };
}

describe("BookingsService.getPackingList with the forecast for the Trip dates", () => {
	it("uses the 10/11 forecast instead of today's Route assessment", async () => {
		const { service, weatherRiskRepository, tripWeatherForecasts, dataSourceQuery } = build({
			id: "forecast-1",
			status: TripWeatherForecastStatus.AVAILABLE,
			riskLevel: RiskLevel.YELLOW,
			criteriaScores: {
				rainfall: criterion(RiskLevel.YELLOW),
				wind: criterion(RiskLevel.GREEN),
				temperature: criterion(RiskLevel.GREEN),
				visibility: criterion(RiskLevel.GREEN),
				thunderstorm: criterion(RiskLevel.GREEN),
			},
		});

		const list = await service.getPackingList(OWNER_ID, BOOKING_ID);

		expect(tripWeatherForecasts.tryEnsureTripForecast).toHaveBeenCalledWith(TRIP_ID);
		expect(weatherRiskRepository.findLatestAssessmentForRoute).not.toHaveBeenCalled();
		expect(list.context).toMatchObject({
			weatherRiskLevel: RiskLevel.YELLOW,
			weatherSource: "trip_forecast",
		});
		expect(list.items.map((item) => item.id)).toContain("rain-gear");
		const generatedFrom = JSON.parse(dataSourceQuery.mock.calls[0][1][1] as string);
		expect(generatedFrom).toMatchObject({
			weatherAssessment: null,
			weatherForecast: { id: "forecast-1", riskLevel: RiskLevel.YELLOW },
		});
	});

	it.each([
		[
			"the Trip is beyond the forecast horizon",
			{
				id: "f",
				status: TripWeatherForecastStatus.OUT_OF_RANGE,
				riskLevel: null,
				criteriaScores: null,
			},
		],
		["no forecast could be obtained", null],
	])("shows no weather (not today's) when %s", async (_label, forecast) => {
		const { service, weatherRiskRepository } = build(forecast);
		const list = await service.getPackingList(OWNER_ID, BOOKING_ID);
		expect(weatherRiskRepository.findLatestAssessmentForRoute).not.toHaveBeenCalled();
		expect(list.context).toMatchObject({ weatherRiskLevel: null, weatherSource: null });
		expect(list.items.map((item) => item.id)).not.toContain("rain-gear");
	});
});

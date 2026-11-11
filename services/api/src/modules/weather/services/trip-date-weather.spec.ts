import { ConflictException, NotFoundException } from "@nestjs/common";
import {
	TripWeatherForecast,
	TripWeatherForecastStatus,
} from "../entities/trip-weather-forecast.entity";
import { RiskLevel, WeatherRiskAssessment } from "../entities/weather-risk-assessment.entity";
import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import type { WeatherForecastHour } from "../providers/weather-provider.interface";
import { RouteRegistrationRiskService } from "./route-registration-risk.service";
import { TripWeatherForecastService } from "./trip-weather-forecast.service";

/**
 * A Trip booked for 10/11 must be judged by the forecast for 10/11, not by today's (7/11) weather.
 */
const NOW = new Date("2026-11-07T03:00:00.000Z");
const STARTS = new Date("2026-11-10T00:00:00.000Z"); // 10/11 07:00 Vietnam time
const ENDS = new Date("2026-11-10T10:00:00.000Z");

const RULE = {
	id: "rule-1",
	rainfallYellowThreshold: 10,
	rainfallRedThreshold: 50,
	windYellowThreshold: 40,
	windRedThreshold: 70,
	tempLowYellow: 5,
	tempLowRed: 0,
	tempHighYellow: 38,
	tempHighRed: 42,
	visibilityYellowThreshold: 5000,
	visibilityRedThreshold: 1000,
	thunderstormYellow: true,
	thunderstormRed: true,
	rainfallWeight: 0.3,
	windWeight: 0.25,
	temperatureWeight: 0.15,
	visibilityWeight: 0.15,
	thunderstormWeight: 0.15,
	greenMaxScore: 0.5,
	yellowMaxScore: 1.2,
} as WeatherRiskRule;

function hour(iso: string, overrides: Partial<WeatherForecastHour> = {}): WeatherForecastHour {
	return {
		time: new Date(iso),
		rainfallMm: 0,
		windKph: 5,
		temperatureC: 22,
		visibilityM: 20000,
		thunderstorm: false,
		providerWeatherCode: 1,
		...overrides,
	};
}

function buildForecastService(tripOverrides: Record<string, unknown> = {}) {
	const trip = {
		id: "trip-1",
		hostId: "host-1",
		status: "published",
		routeId: "route-1",
		startsAt: STARTS,
		endsAt: ENDS,
		submittedWeatherForecastId: null,
		centroid: [108.2, 16.05] as [number, number],
		...tripOverrides,
	};
	const forecastsRepository = {
		findTripForForecast: jest.fn().mockResolvedValue(trip),
		findLatestForTrip: jest.fn().mockResolvedValue(null),
		findLatestAvailableForTrip: jest.fn().mockResolvedValue(null),
		touchCheckedAt: jest.fn().mockImplementation(async (row, checkedAt) => ({ ...row, checkedAt })),
		create: jest.fn().mockImplementation((value) => value),
		save: jest
			.fn()
			.mockImplementation((value) =>
				Promise.resolve({ id: "forecast-1", createdAt: NOW, ...value })
			),
	};
	const weatherRiskRepository = { findActiveRule: jest.fn().mockResolvedValue(RULE) };
	const weatherProvider = {
		fetchCurrent: jest.fn(),
		fetchHourlyForecast: jest.fn().mockResolvedValue({
			hours: [
				hour("2026-11-10T00:00:00Z"),
				hour("2026-11-10T05:00:00Z", { rainfallMm: 80, windKph: 90, thunderstorm: true }),
			],
			raw: {},
		}),
	};
	const service = new TripWeatherForecastService(
		forecastsRepository as never,
		weatherRiskRepository as never,
		weatherProvider as never,
		{ generate: jest.fn() } as never
	);
	return { service, forecastsRepository, weatherProvider };
}

describe("Trip-date weather for travellers", () => {
	describe("TripWeatherForecastService.forecastForTravellers", () => {
		it("forecasts the Trip's own dates (10/11), not today's weather", async () => {
			const { service, weatherProvider } = buildForecastService();
			const result = await service.forecastForTravellers("trip-1", NOW);

			expect(weatherProvider.fetchCurrent).not.toHaveBeenCalled();
			const [, , from, to] = weatherProvider.fetchHourlyForecast.mock.calls[0];
			expect(from).toEqual(STARTS);
			expect(to).toEqual(ENDS);
			expect(result).toMatchObject({
				status: TripWeatherForecastStatus.AVAILABLE,
				tripStartsAt: STARTS,
				riskLevel: RiskLevel.RED,
			});
		});

		it("records a traveller-triggered forecast under the Trip's Host, never the Camper", async () => {
			const { service, forecastsRepository } = buildForecastService();
			await service.forecastForTravellers("trip-1", NOW);
			await service.tryEnsureTripForecast("trip-1", NOW);
			for (const [saved] of forecastsRepository.save.mock.calls) {
				expect(saved.createdBy).toBe("host-1");
			}
			expect(forecastsRepository.save).toHaveBeenCalledTimes(2);
		});

		it("forecasts an ongoing Trip from the current hour", async () => {
			const { service, weatherProvider } = buildForecastService({
				status: "ongoing",
				startsAt: new Date("2026-11-07T01:00:00.000Z"),
			});
			weatherProvider.fetchHourlyForecast.mockResolvedValue({
				hours: [hour("2026-11-07T03:00:00Z")],
				raw: {},
			});
			await service.forecastForTravellers("trip-1", NOW);
			expect(weatherProvider.fetchHourlyForecast.mock.calls[0][2]).toEqual(NOW);
		});

		it("says out of range for a Trip beyond the 15-day horizon instead of using today's weather", async () => {
			const { service, weatherProvider } = buildForecastService({
				startsAt: new Date("2026-12-01T00:00:00.000Z"),
				endsAt: new Date("2026-12-01T10:00:00.000Z"),
			});
			const result = await service.forecastForTravellers("trip-1", NOW);
			expect(result.status).toBe(TripWeatherForecastStatus.OUT_OF_RANGE);
			expect(result.riskLevel ?? null).toBeNull();
			expect(weatherProvider.fetchHourlyForecast).not.toHaveBeenCalled();
			expect(weatherProvider.fetchCurrent).not.toHaveBeenCalled();
		});

		it.each(["draft", "pending_approval", "completed", "cancelled"])(
			"hides a %s Trip from travellers",
			async (status) => {
				const { service } = buildForecastService({ status });
				await expect(service.forecastForTravellers("trip-1", NOW)).rejects.toBeInstanceOf(
					NotFoundException
				);
			}
		);

		it("returns 404 for an absent Trip", async () => {
			const { service, forecastsRepository } = buildForecastService();
			forecastsRepository.findTripForForecast.mockResolvedValue(null);
			await expect(service.forecastForTravellers("trip-1", NOW)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});

	describe("TripWeatherForecastService.tryEnsureTripForecast", () => {
		it("returns the stored forecast for the Trip dates", async () => {
			const { service } = buildForecastService();
			await expect(service.tryEnsureTripForecast("trip-1", NOW)).resolves.toMatchObject({
				id: "forecast-1",
				status: TripWeatherForecastStatus.AVAILABLE,
			});
		});

		it("never throws when the provider is down", async () => {
			jest.useFakeTimers({ advanceTimers: true });
			const { service, weatherProvider } = buildForecastService();
			weatherProvider.fetchHourlyForecast.mockRejectedValue(new Error("down"));
			await expect(service.tryEnsureTripForecast("trip-1", NOW)).resolves.toBeNull();
			jest.useRealTimers();
		});

		it("returns null for a Trip travellers cannot see", async () => {
			const { service } = buildForecastService({ status: "draft" });
			await expect(service.tryEnsureTripForecast("trip-1", NOW)).resolves.toBeNull();
		});
	});

	describe("RouteRegistrationRiskService.assertBookingWeatherAllowed with the Trip dates", () => {
		const schedule = { id: "trip-1", startsAt: STARTS, endsAt: ENDS };

		function forecast(overrides: Partial<TripWeatherForecast> = {}): Partial<TripWeatherForecast> {
			return {
				id: "forecast-1",
				tripId: "trip-1",
				status: TripWeatherForecastStatus.AVAILABLE,
				tripStartsAt: STARTS,
				tripEndsAt: ENDS,
				riskLevel: RiskLevel.GREEN,
				compositeScore: 0.2,
				criteriaScores: null,
				createdAt: new Date(NOW.getTime() - 60_000),
				...overrides,
			};
		}

		function build(tripForecast: Partial<TripWeatherForecast> | null, routeRisk: RiskLevel) {
			const forecastFindOne = jest.fn().mockResolvedValue(tripForecast);
			const assessmentFindOne = jest.fn().mockResolvedValue({
				routeId: "route-1",
				riskLevel: routeRisk,
				compositeScore: routeRisk === RiskLevel.RED ? 1.6 : 0.1,
				createdAt: NOW,
				criteriaScores: {},
			});
			const manager = {
				getRepository: jest.fn((entity: unknown) => ({
					findOne: entity === TripWeatherForecast ? forecastFindOne : assessmentFindOne,
				})),
			};
			const service = new RouteRegistrationRiskService({} as never, {} as never);
			return { service, manager, assessmentFindOne };
		}

		it("allows a 10/11 booking with a Green 10/11 forecast even when today's Route weather is Red", async () => {
			const { service, manager, assessmentFindOne } = build(forecast(), RiskLevel.RED);
			const result = await service.assertBookingWeatherAllowed(
				"route-1",
				manager as never,
				schedule,
				NOW
			);
			expect(result).toMatchObject({ allowed: true, riskLevel: RiskLevel.GREEN });
			expect(assessmentFindOne).not.toHaveBeenCalled();
		});

		it("blocks a 10/11 booking with a Red 10/11 forecast even when today's Route weather is Green", async () => {
			const { service, manager } = build(
				forecast({ riskLevel: RiskLevel.RED, compositeScore: 1.5 }),
				RiskLevel.GREEN
			);
			await expect(
				service.assertBookingWeatherAllowed("route-1", manager as never, schedule, NOW)
			).rejects.toThrow(/dự báo thời tiết trong ngày diễn ra chuyến đi/);
		});

		it("allows a Red forecast more than 3 days before departure (low reliability, Host decides later)", async () => {
			const far = {
				id: "trip-1",
				startsAt: new Date("2026-11-17T00:00:00.000Z"),
				endsAt: new Date("2026-11-17T10:00:00.000Z"),
			};
			const { service, manager } = build(
				forecast({
					riskLevel: RiskLevel.RED,
					compositeScore: 1.5,
					tripStartsAt: far.startsAt,
					tripEndsAt: far.endsAt,
				}),
				RiskLevel.GREEN
			);
			await expect(
				service.assertBookingWeatherAllowed("route-1", manager as never, far, NOW)
			).resolves.toMatchObject({ allowed: true, riskLevel: RiskLevel.RED });
		});

		it("does not block a Trip beyond the forecast horizon on today's weather", async () => {
			const { service, manager, assessmentFindOne } = build(
				forecast({
					status: TripWeatherForecastStatus.OUT_OF_RANGE,
					riskLevel: null,
					compositeScore: null,
				}),
				RiskLevel.RED
			);
			await expect(
				service.assertBookingWeatherAllowed("route-1", manager as never, schedule, NOW)
			).resolves.toMatchObject({ allowed: true, riskLevel: null });
			expect(assessmentFindOne).not.toHaveBeenCalled();
		});

		it.each([
			["no trip-date forecast", null],
			[
				"a forecast older than 6 hours",
				forecast({ createdAt: new Date(NOW.getTime() - 7 * 3600_000) }),
			],
			[
				"a forecast for an older schedule",
				forecast({ tripStartsAt: new Date("2026-11-09T00:00:00.000Z") }),
			],
		])("falls back to the Route rule with %s", async (_label, stored) => {
			const { service, manager, assessmentFindOne } = build(stored, RiskLevel.RED);
			await expect(
				service.assertBookingWeatherAllowed("route-1", manager as never, schedule, NOW)
			).rejects.toBeInstanceOf(ConflictException);
			expect(assessmentFindOne).toHaveBeenCalled();
			expect(manager.getRepository).toHaveBeenCalledWith(WeatherRiskAssessment);
		});

		it("keeps the original Route rule when no Trip schedule is passed", async () => {
			const { service, manager } = build(forecast(), RiskLevel.GREEN);
			await service.assertBookingWeatherAllowed("route-1", manager as never);
			expect(manager.getRepository).not.toHaveBeenCalledWith(TripWeatherForecast);
		});
	});
});

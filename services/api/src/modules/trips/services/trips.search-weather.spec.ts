import type { DataSource } from "typeorm";
import { TripWeatherForecastStatus } from "../../weather/entities/trip-weather-forecast.entity";
import { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { TripWeatherForecastService } from "../../weather/services/trip-weather-forecast.service";
import type { TripsRepository } from "../repositories/trips.repository";
import { TripsService } from "./trips.service";

/** The search list badge follows the forecast for each Trip's own dates, not today's Route weather. */
describe("TripsService.search weather badge", () => {
	const query = { page: 1, limit: 20 };

	function build(forecasts: Record<string, unknown> | null) {
		const repository = {
			searchPublishedTrips: jest.fn().mockResolvedValue({
				items: [
					{ id: "near", weatherRiskLevel: RiskLevel.RED },
					{ id: "far", weatherRiskLevel: RiskLevel.RED },
					{ id: "down", weatherRiskLevel: RiskLevel.GREEN },
				],
				total: 3,
			}),
		};
		const forecastService = forecasts
			? { tryEnsureTripForecast: jest.fn(async (tripId: string) => forecasts[tripId] ?? null) }
			: undefined;
		const service = new TripsService(
			repository as unknown as TripsRepository,
			{} as DataSource,
			undefined,
			undefined,
			undefined,
			forecastService as unknown as TripWeatherForecastService
		);
		return { service, forecastService };
	}

	it("replaces today's Route risk with the risk of the forecast for each Trip's dates", async () => {
		const { service, forecastService } = build({
			near: { status: TripWeatherForecastStatus.AVAILABLE, riskLevel: RiskLevel.GREEN },
			far: { status: TripWeatherForecastStatus.OUT_OF_RANGE, riskLevel: null },
		});

		const result = await service.search(query as never, "camper-1");

		expect(forecastService?.tryEnsureTripForecast).toHaveBeenCalledWith("near");
		expect(result.items).toEqual([
			{ id: "near", weatherRiskLevel: RiskLevel.GREEN, weatherForecastStatus: "available" },
			{ id: "far", weatherRiskLevel: null, weatherForecastStatus: "out_of_range" },
			{ id: "down", weatherRiskLevel: null, weatherForecastStatus: "unavailable" },
		]);
	});

	it("leaves items untouched when no viewer or forecast service is available", async () => {
		const { service } = build(null);
		const result = await service.search(query as never, "camper-1");
		expect(result.items[0]).toEqual({ id: "near", weatherRiskLevel: RiskLevel.RED });
	});
});

import { HostAnalyticsWeatherService } from "./host-analytics-weather.service";

describe("HostAnalyticsWeatherService", () => {
	const mockActiveRule = {
		rainfallYellowThreshold: 5,
		rainfallRedThreshold: 20,
		rainfallWeight: 0.3,
		windYellowThreshold: 25,
		windRedThreshold: 50,
		windWeight: 0.25,
		temperatureMinYellow: 10,
		temperatureMinRed: 5,
		temperatureMaxYellow: 34,
		temperatureMaxRed: 38,
		temperatureWeight: 0.15,
		visibilityYellowThreshold: 3000,
		visibilityRedThreshold: 1000,
		visibilityWeight: 0.15,
		thunderstormWeight: 0.15,
		yellowCompositeThreshold: 0.35,
		redCompositeThreshold: 0.65,
	};

	it("returns beyond_horizon when date is > 15 days away without calling provider", async () => {
		const provider = { fetchHourlyForecast: jest.fn(), fetchCurrent: jest.fn() };
		const ruleRepo = { findActiveRule: jest.fn().mockResolvedValue(mockActiveRule) };
		const svc = new HostAnalyticsWeatherService(provider as never, ruleRepo as never);

		const now = new Date("2026-11-20T00:00:00Z");
		const res = await svc.evaluateWindow({
			areaKey: "DNG-SON-TRA",
			latitude: 16.1,
			longitude: 108.25,
			startsAt: new Date("2026-12-20T00:00:00Z"),
			endsAt: new Date("2026-12-20T06:00:00Z"),
			areasBudget: new Set(),
			now,
		});

		expect(res.status).toBe("beyond_horizon");
		expect(res.summary).toBe("Chưa có dự báo cho thời điểm này");
		expect(provider.fetchHourlyForecast).not.toHaveBeenCalled();
	});

	it("scores RED weather risk within 15-day horizon and fails open on provider error", async () => {
		const provider = {
			fetchHourlyForecast: jest
				.fn()
				.mockResolvedValueOnce({
					hours: [
						{
							time: new Date("2026-12-04T01:00:00Z"),
							rainfallMm: 35,
							windKph: 60,
							temperatureC: 22,
							visibilityM: 500,
							thunderstorm: true,
							providerWeatherCode: 95,
						},
					],
				})
				.mockRejectedValueOnce(new Error("Open-Meteo 429 cooldown")),
			fetchCurrent: jest.fn(),
		};
		const ruleRepo = { findActiveRule: jest.fn().mockResolvedValue(mockActiveRule) };
		const svc = new HostAnalyticsWeatherService(provider as never, ruleRepo as never);

		const now = new Date("2026-11-20T00:00:00Z");
		const redRes = await svc.evaluateWindow({
			areaKey: "DNG-SON-TRA",
			latitude: 16.1,
			longitude: 108.25,
			startsAt: new Date("2026-12-04T01:00:00Z"),
			endsAt: new Date("2026-12-04T06:00:00Z"),
			areasBudget: new Set(),
			now,
		});
		expect(redRes.status).toBe("available");
		expect(redRes.riskLevel).toBe("red");

		// Provider failure -> fail-open unavailable (never throws)
		const failRes = await svc.evaluateWindow({
			areaKey: "DNG-HOA-VANG",
			latitude: 16.0,
			longitude: 108.0,
			startsAt: new Date("2026-12-04T01:00:00Z"),
			endsAt: new Date("2026-12-04T06:00:00Z"),
			areasBudget: new Set(),
			now,
		});
		expect(failRes.status).toBe("unavailable");
		expect(failRes.riskLevel).toBeNull();
	});
});

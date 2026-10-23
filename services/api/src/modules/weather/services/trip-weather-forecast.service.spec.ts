import type { WeatherRiskRule } from "../entities/weather-risk-rule.entity";
import type { WeatherForecastHour } from "../providers/weather-provider.interface";
import { forecastHorizonEnd, worstReading } from "./trip-weather-forecast.service";
import { scoreWeatherReading } from "./weather-risk-scoring";

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

describe("worstReading", () => {
	it("takes the worst hour of each criterion independently", () => {
		const worst = worstReading(
			[
				hour("2026-10-20T01:00:00Z", { rainfallMm: 12 }),
				hour("2026-10-20T02:00:00Z", { windKph: 55, visibilityM: 800 }),
				hour("2026-10-20T03:00:00Z", { thunderstorm: true }),
			],
			RULE
		);

		expect(worst).toMatchObject({
			rainfallMm: 12,
			rainfallAt: "2026-10-20T01:00:00.000Z",
			windKph: 55,
			visibilityM: 800,
			visibilityAt: "2026-10-20T02:00:00.000Z",
			thunderstorm: true,
			thunderstormAt: "2026-10-20T03:00:00.000Z",
			hoursCovered: 3,
		});
	});

	it("picks the temperature with the highest risk score, cold or hot", () => {
		const worst = worstReading(
			[
				hour("2026-10-20T01:00:00Z", { temperatureC: 39 }),
				hour("2026-10-20T02:00:00Z", { temperatureC: -1 }),
				hour("2026-10-20T03:00:00Z", { temperatureC: 25 }),
			],
			RULE
		);
		expect(worst.temperatureC).toBe(-1);
	});

	it("feeds the scorer so one dangerous hour makes the whole Trip Red", () => {
		const worst = worstReading(
			[
				hour("2026-10-20T01:00:00Z"),
				hour("2026-10-20T02:00:00Z", { rainfallMm: 80, windKph: 90, thunderstorm: true }),
			],
			RULE
		);
		const scored = scoreWeatherReading(worst, RULE);
		expect(scored.riskLevel).toBe("red");
	});
});

describe("forecastHorizonEnd", () => {
	it("ends at 23:00 UTC on the 15th day after today", () => {
		expect(forecastHorizonEnd(new Date("2026-10-18T07:30:00Z")).toISOString()).toBe(
			"2026-11-02T23:00:00.000Z"
		);
	});
});

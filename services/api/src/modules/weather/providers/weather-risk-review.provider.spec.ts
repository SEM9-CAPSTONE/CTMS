import type { ConfigService } from "@nestjs/config";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";
import {
	HttpWeatherRiskReviewProvider,
	WeatherRiskReviewError,
	parseReview,
} from "./weather-risk-review.provider";

const INPUT = {
	rainfallMm: 12,
	windKph: 30,
	temperatureC: 22,
	visibilityM: 6000,
	thunderstorm: false,
	hoursCovered: 20,
};

function provider(env: Record<string, string | undefined>) {
	const config = { get: (key: string) => env[key] } as unknown as ConfigService;
	return new HttpWeatherRiskReviewProvider(config);
}

function response(status: number, body: unknown): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
	} as Response;
}

describe("HttpWeatherRiskReviewProvider", () => {
	const fetchMock = jest.fn();
	beforeEach(() => {
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	it("is not configured without the AI service token", async () => {
		const subject = provider({ AI_REVIEW_SERVICE_TOKEN: " " });
		expect(subject.isConfigured()).toBe(false);
		await expect(subject.review(INPUT)).rejects.toMatchObject({
			code: "provider_not_configured",
			retryable: false,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("posts snake_case raw readings with the internal token", async () => {
		fetchMock.mockResolvedValue(
			response(200, { level: "yellow", reason: "Mưa vừa.", confidence: 0.6, model: "m" })
		);
		const result = await provider({
			AI_REVIEW_SERVICE_TOKEN: "secret",
			AI_SERVICE_URL: "http://ai:8000",
		}).review(INPUT);

		expect(result).toEqual({
			level: RiskLevel.YELLOW,
			reason: "Mưa vừa.",
			confidence: 0.6,
			model: "m",
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("http://ai:8000/weather-risk-review");
		expect(init.headers["X-CTMS-AI-Token"]).toBe("secret");
		expect(JSON.parse(init.body)).toEqual({
			rainfall_mm: 12,
			wind_kph: 30,
			temperature_c: 22,
			visibility_m: 6000,
			thunderstorm: false,
			hours_covered: 20,
		});
	});

	it.each([
		[503, true],
		[429, true],
		[422, false],
		[401, false],
	])("maps HTTP %i to retryable=%s", async (status, retryable) => {
		fetchMock.mockResolvedValue(response(status, { detail: { code: "x" } }));
		await expect(
			provider({ AI_REVIEW_SERVICE_TOKEN: "secret" }).review(INPUT)
		).rejects.toMatchObject({ code: `provider_http_${status}`, retryable });
	});

	it("treats a network error as retryable", async () => {
		fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
		await expect(
			provider({ AI_REVIEW_SERVICE_TOKEN: "secret" }).review(INPUT)
		).rejects.toMatchObject({ code: "provider_transport", retryable: true });
	});
});

describe("parseReview", () => {
	it.each([
		{ level: "purple", reason: "x", confidence: 0.5, model: "m" },
		{ level: "red", reason: " ", confidence: 0.5, model: "m" },
		{ level: "red", reason: "x", confidence: 2, model: "m" },
		{ level: "red", reason: "x", confidence: 0.5, model: "" },
		null,
	])("rejects malformed output %#", (body) => {
		expect(() => parseReview(body)).toThrow(WeatherRiskReviewError);
	});
});

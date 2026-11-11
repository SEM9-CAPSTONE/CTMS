import { ConfigService } from "@nestjs/config";
import { HttpWeatherAdviceProvider } from "./http-weather-advice.provider";
import type { WeatherAdviceRequestPayload } from "./weather-advice-provider.interface";
import { WeatherAdviceProviderError } from "./weather-advice-provider.interface";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return {
		ok,
		status,
		json: () => Promise.resolve(body),
	} as unknown as Response;
}

const samplePayload: WeatherAdviceRequestPayload = {
	riskLevel: "yellow",
	compositeScore: 1.2,
	rainfall: { value: 5, level: "yellow", weight: 0.3, score: 1 },
	wind: { value: 20, level: "green", weight: 0.2, score: 0 },
	temperature: { value: 28, level: "green", weight: 0.2, score: 0 },
	visibility: { value: 8000, level: "green", weight: 0.2, score: 0 },
	thunderstorm: { value: false, level: "green", weight: 0.1, score: 0 },
};

describe("HttpWeatherAdviceProvider", () => {
	let provider: HttpWeatherAdviceProvider;
	let fetchMock: jest.Mock;

	beforeEach(() => {
		provider = new HttpWeatherAdviceProvider(new ConfigService());
		fetchMock = jest.fn();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("posts the snake_case payload to {AI_SERVICE_URL}/weather-advisory and maps a successful response", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				advice: "Điều kiện thời tiết ở mức cảnh báo nhẹ.",
				actions: ["Theo dõi dự báo trước giờ khởi hành"],
			})
		);

		const result = await provider.generate(samplePayload);

		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:8000/weather-advisory",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			})
		);
		const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(sentBody).toEqual({
			risk_level: "yellow",
			composite_score: 1.2,
			rainfall: samplePayload.rainfall,
			wind: samplePayload.wind,
			temperature: samplePayload.temperature,
			visibility: samplePayload.visibility,
			thunderstorm: samplePayload.thunderstorm,
		});
		expect(result).toEqual({
			adviceText: "Điều kiện thời tiết ở mức cảnh báo nhẹ.",
			actions: ["Theo dõi dự báo trước giờ khởi hành"],
		});
	});

	it("uses AI_SERVICE_URL from ConfigService when set", async () => {
		const configService = new ConfigService({ AI_SERVICE_URL: "http://ai:8000" });
		provider = new HttpWeatherAdviceProvider(configService);
		fetchMock.mockResolvedValue(jsonResponse({ advice: "ok", actions: ["a"] }));

		await provider.generate(samplePayload);

		expect(fetchMock).toHaveBeenCalledWith("http://ai:8000/weather-advisory", expect.anything());
	});

	it("throws WeatherAdviceProviderError when the network request itself fails", async () => {
		fetchMock.mockRejectedValue(new Error("fetch failed"));

		await expect(provider.generate(samplePayload)).rejects.toThrow(WeatherAdviceProviderError);
	});

	it("throws WeatherAdviceProviderError when the response body is not valid JSON", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.reject(new Error("Unexpected token")),
		} as unknown as Response);

		await expect(provider.generate(samplePayload)).rejects.toThrow(WeatherAdviceProviderError);
	});

	it("throws WeatherAdviceProviderError with the service's own detail on a non-2xx response", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(
				{ detail: "Weather advisory service is not configured (missing OPENAI_API_KEY)." },
				false,
				503
			)
		);

		await expect(provider.generate(samplePayload)).rejects.toThrow(WeatherAdviceProviderError);
		await expect(provider.generate(samplePayload)).rejects.toThrow(
			"Weather advisory service is not configured (missing OPENAI_API_KEY)."
		);
	});

	it("throws WeatherAdviceProviderError when the response is missing advice/actions despite a 2xx status", async () => {
		fetchMock.mockResolvedValue(jsonResponse({}));

		await expect(provider.generate(samplePayload)).rejects.toThrow(WeatherAdviceProviderError);
	});
});

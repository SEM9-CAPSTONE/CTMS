import { ConfigService } from "@nestjs/config";
import { OpenMeteoWeatherProvider } from "./open-meteo-weather.provider";
import { WeatherProviderError } from "./weather-provider.interface";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
	return {
		ok,
		status,
		json: () => Promise.resolve(body),
	} as unknown as Response;
}

describe("OpenMeteoWeatherProvider", () => {
	let provider: OpenMeteoWeatherProvider;
	let fetchMock: jest.Mock;

	beforeEach(() => {
		provider = new OpenMeteoWeatherProvider(new ConfigService());
		fetchMock = jest.fn();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("parses a real-shaped success response, mapping every BR-065 field", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				current: {
					time: "2026-08-29T11:30",
					temperature_2m: 32.2,
					precipitation: 0,
					rain: 0,
					weather_code: 3,
					wind_speed_10m: 10.4,
					visibility: 23780,
				},
			})
		);

		const reading = await provider.fetchCurrent(16.0678, 108.2208);

		expect(reading.observedAt.toISOString()).toBe("2026-08-29T11:30:00.000Z");
		expect(reading.rainfallMm).toBe(0);
		expect(reading.windKph).toBe(10.4);
		expect(reading.temperatureC).toBe(32.2);
		expect(reading.visibilityM).toBe(23780);
		expect(reading.thunderstorm).toBe(false);
		expect(reading.providerWeatherCode).toBe(3);
	});

	it.each([95, 96, 99])(
		"maps WMO weather_code %d to thunderstorm=true (the standard's own thunderstorm family)",
		async (code) => {
			fetchMock.mockResolvedValue(
				jsonResponse({
					current: {
						time: "2026-08-29T11:30",
						temperature_2m: 28,
						precipitation: 12,
						rain: 12,
						weather_code: code,
						wind_speed_10m: 25,
						visibility: 4000,
					},
				})
			);

			const reading = await provider.fetchCurrent(16.0678, 108.2208);
			expect(reading.thunderstorm).toBe(true);
		}
	);

	it("throws WeatherProviderError on a non-2xx response, using the provider's own reason", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ error: true, reason: "Latitude must be in range of -90 to 90°." }, false, 400)
		);

		await expect(provider.fetchCurrent(999, 108.22)).rejects.toThrow(WeatherProviderError);
		await expect(provider.fetchCurrent(999, 108.22)).rejects.toThrow(
			"Latitude must be in range of -90 to 90°."
		);
	});

	it("throws WeatherProviderError when the body has no current block", async () => {
		fetchMock.mockResolvedValue(jsonResponse({}));

		await expect(provider.fetchCurrent(16, 108)).rejects.toThrow(WeatherProviderError);
	});

	it("throws WeatherProviderError when the response body is not valid JSON", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.reject(new Error("Unexpected token")),
		} as unknown as Response);

		await expect(provider.fetchCurrent(16, 108)).rejects.toThrow(WeatherProviderError);
	});

	it("throws WeatherProviderError when the network request itself fails (timeout/DNS/etc.)", async () => {
		fetchMock.mockRejectedValue(new Error("fetch failed"));

		await expect(provider.fetchCurrent(16, 108)).rejects.toThrow(WeatherProviderError);
	});
});

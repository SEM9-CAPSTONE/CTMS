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
		jest.useRealTimers();
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

	it("shares identical in-flight requests instead of calling Open-Meteo once per caller", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: true, reason: "No data" }));
		const results = await Promise.allSettled(
			Array.from({ length: 5 }, () => provider.fetchCurrent(16, 108))
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(results.every((result) => result.status === "rejected")).toBe(true);
		// A settled request must be removed, so a later caller can obtain new data.
		await expect(provider.fetchCurrent(16, 108)).rejects.toThrow("No data");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("limits distinct concurrent requests and releases queued work", async () => {
		jest.useFakeTimers();
		const complete: Array<(response: Response) => void> = [];
		fetchMock.mockImplementation(() => new Promise<Response>((resolve) => complete.push(resolve)));
		const results = Promise.allSettled(
			Array.from({ length: 5 }, (_, index) => provider.fetchCurrent(16 + index, 108))
		);
		await jest.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		complete[0](jsonResponse({ error: true, reason: "No data" }));
		await jest.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		complete[1](jsonResponse({ error: true, reason: "No data" }));
		await jest.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledTimes(5);
		for (const resolve of complete.slice(2)) {
			resolve(jsonResponse({ error: true, reason: "No data" }));
		}
		await results;
	});

	it("pauses queued requests after an outage and allows recovery after the cooldown", async () => {
		jest.useFakeTimers();
		fetchMock.mockRejectedValue(new Error("fetch failed"));
		const results = await Promise.allSettled(
			Array.from({ length: 8 }, (_, index) => provider.fetchCurrent(16 + index, 108))
		);
		expect(results.every((result) => result.status === "rejected")).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		await expect(provider.fetchCurrent(16, 108)).rejects.toMatchObject({ retryable: false });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		await jest.advanceTimersByTimeAsync(60_000);
		fetchMock.mockResolvedValue(
			jsonResponse({
				current: {
					time: "2026-11-18T01:00",
					temperature_2m: 24,
					precipitation: 0,
					rain: 0,
					weather_code: 1,
					wind_speed_10m: 8,
					visibility: 20000,
				},
			})
		);
		await expect(provider.fetchCurrent(16, 108)).resolves.toMatchObject({ temperatureC: 24 });
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it.each(["current", "hourly"])("times out while reading the %s response body", async (kind) => {
		jest.useFakeTimers();
		provider = new OpenMeteoWeatherProvider(new ConfigService({ WEATHER_API_TIMEOUT_MS: "25" }));
		fetchMock.mockImplementation((_url: URL, options: RequestInit) =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					new Promise((_resolve, reject) => {
						options.signal?.addEventListener("abort", () => reject(new Error("aborted")));
					}),
			} as unknown as Response)
		);
		const request =
			kind === "current"
				? provider.fetchCurrent(16, 108)
				: provider.fetchHourlyForecast(
						16,
						108,
						new Date("2026-11-18T01:00Z"),
						new Date("2026-11-18T05:00Z")
					);
		const assertion = expect(request).rejects.toMatchObject({
			message: "Weather provider timed out after 25ms",
			retryable: false,
		});
		await jest.advanceTimersByTimeAsync(25);
		await assertion;
	});

	it.each(["", "0", "-1", "invalid"])(
		"uses the default timeout for invalid configuration %j",
		async (value) => {
			jest.useFakeTimers();
			provider = new OpenMeteoWeatherProvider(new ConfigService({ WEATHER_API_TIMEOUT_MS: value }));
			fetchMock.mockImplementation(
				(_url: URL, options: RequestInit) =>
					new Promise((_resolve, reject) => {
						options.signal?.addEventListener("abort", () => reject(new Error("aborted")));
					})
			);
			const assertion = expect(provider.fetchCurrent(16, 108)).rejects.toThrow(
				"timed out after 8000ms"
			);
			await jest.advanceTimersByTimeAsync(8000);
			await assertion;
		}
	);

	it("honours Retry-After on rate limiting without parsing the error body", async () => {
		jest.useFakeTimers();
		const json = jest.fn().mockRejectedValue(new Error("not JSON"));
		fetchMock.mockResolvedValue({
			ok: false,
			status: 429,
			headers: new Headers({ "retry-after": "120" }),
			json,
		} as unknown as Response);
		await expect(provider.fetchCurrent(16, 108)).rejects.toMatchObject({ retryable: false });
		expect(json).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(60_000);
		await expect(provider.fetchCurrent(17, 108)).rejects.toThrow("temporarily unavailable");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await jest.advanceTimersByTimeAsync(60_000);
		await expect(provider.fetchCurrent(17, 108)).rejects.toThrow("HTTP 429");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("maps the hourly forecast and keeps requests for different schedules separate", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				hourly: {
					time: ["2026-11-18T01:00", "2026-11-18T02:00"],
					temperature_2m: [24, null],
					rain: [5, 2],
					weather_code: [95, 1],
					wind_speed_10m: [30, 8],
					visibility: [4000, 20000],
				},
			})
		);
		const from = new Date("2026-11-18T01:15Z");
		const forecasts = await Promise.all([
			provider.fetchHourlyForecast(16, 108, from, new Date("2026-11-18T03:00Z")),
			provider.fetchHourlyForecast(16, 108, from, new Date("2026-11-18T04:00Z")),
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(forecasts[0].hours).toEqual([
			{
				time: new Date("2026-11-18T01:00Z"),
				temperatureC: 24,
				rainfallMm: 5,
				windKph: 30,
				visibilityM: 4000,
				thunderstorm: true,
				providerWeatherCode: 95,
			},
		]);
		expect((fetchMock.mock.calls[0][0] as URL).searchParams.get("start_hour")).toBe(
			"2026-11-18T01:00"
		);
	});

	it("pauses requests on a non-JSON server error", async () => {
		const json = jest.fn().mockRejectedValue(new Error("Unexpected token <"));
		fetchMock.mockResolvedValue({ ok: false, status: 503, json } as unknown as Response);
		await expect(provider.fetchCurrent(16, 108)).rejects.toMatchObject({
			message: "Weather provider returned HTTP 503",
			retryable: false,
		});
		await expect(provider.fetchCurrent(17, 108)).rejects.toThrow("temporarily unavailable");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(json).not.toHaveBeenCalled();
	});
});

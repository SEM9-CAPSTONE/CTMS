import { ConfigService } from "@nestjs/config";
import { DemandInsightsProvider } from "./demand-insights.provider";
describe("Demand provider boundary", () => {
	it.each([0, -1, 1.5, 32, "NaN"])("rejects invalid stabilization delay %s", (value) => {
		const instance = new DemandInsightsProvider(
			new ConfigService({ DEMAND_MIN_DAYS_AFTER_CLOSE: value })
		);
		expect(() => instance.configuration()).toThrow();
	});
	const cell = { tripType: "day_trip", difficulty: "easy", bookerBand: { min: 10, max: 19 } };
	const output = {
		suggestions: [
			{ tripType: "day_trip", difficulty: "easy", reason: "observed_booking_interest" },
		],
	};
	let fetchMock: jest.SpyInstance;
	beforeEach(() => {
		fetchMock = jest.spyOn(global, "fetch");
	});
	afterEach(() => fetchMock.mockRestore());
	const provider = (extra: Record<string, unknown> = {}) =>
		new DemandInsightsProvider(
			new ConfigService({
				AI_REVIEW_SERVICE_TOKEN: "test-only-token",
				REVIEW_ANALYSIS_PROVIDER: "gemini",
				...extra,
			})
		);
	it("uses approved defaults and sends only released cells/settings", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify(output), { status: 200 }));
		const p = provider();
		expect(p.configuration()).toMatchObject({ minBookers: 10, minHosts: 3, maxHostShare: 0.75 });
		await expect(p.generate("2026-10", [cell], p.configuration())).resolves.toEqual(
			output.suggestions
		);
		const [url, request] = fetchMock.mock.calls[0];
		expect(url).toBe("http://localhost:8000/demand-insight");
		expect(JSON.parse(request.body)).toEqual({
			month: "2026-10",
			cells: [cell],
			model: "gemini-3.1-flash-lite",
			prompt_version: "demand-v1",
		});
	});
	it.each([
		{ DEMAND_MIN_BOOKERS: 9 },
		{ DEMAND_MIN_HOSTS: 2 },
		{ DEMAND_MAX_HOST_SHARE: 0.9 },
		{ DEMAND_MAX_HOST_SHARE: "NaN" },
		{ REVIEW_ANALYSIS_PROVIDER: "other" },
	])("fails closed for invalid policy %j", (extra) =>
		expect(() => provider(extra).configuration()).toThrow()
	);
	it("rejects missing shared token before network access", async () => {
		const p = provider({ AI_REVIEW_SERVICE_TOKEN: "" });
		await expect(p.generate("2026-10", [cell], p.configuration())).rejects.toMatchObject({
			retryable: false,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it.each([
		[422, "invalid_output", false],
		[429, "insufficient_quota", false],
		[429, "provider_failure", true],
		[503, "provider_failure", true],
		[401, "provider_failure", false],
	] as const)("classifies %i/%s retry eligibility", async (status, code, retryable) => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ detail: { code, private: "not exposed" } }), { status })
		);
		const p = provider();
		await expect(p.generate("2026-10", [cell], p.configuration())).rejects.toMatchObject({
			retryable,
		});
	});
	it("rejects ungrounded model output instead of a fallback", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ suggestions: [{ ...output.suggestions[0], count: 100 }] }), {
				status: 200,
			})
		);
		const p = provider();
		await expect(p.generate("2026-10", [cell], p.configuration())).rejects.toMatchObject({
			code: "invalid_output",
			retryable: false,
		});
	});
});

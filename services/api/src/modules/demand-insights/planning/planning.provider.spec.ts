import { ConfigService } from "@nestjs/config";
import { DemandInsightsProvider } from "../demand-insights.provider";
import { type PlanningSource, buildPlanningContext } from "./planning.policy";
import { PlanningProvider, planningConfigHash } from "./planning.provider";
const source: PlanningSource = {
	booking: "private-booking",
	booker: "private-booker",
	host: "private-host",
	tripType: "day_trip",
	difficulty: "easy",
	snapshotType: null,
	snapshotDifficulty: null,
	priceBand: null,
	capacityBand: null,
	durationBand: null,
	areaCode: null,
	areaLabel: null,
	areaActive: null,
};
const candidates = buildPlanningContext(
	{
		granularity: "trip_type",
		cells: [{ tripType: "day_trip", difficulty: null, bookerBand: { min: 10, max: 19 } }],
	},
	[source]
).candidates;
describe("Planning provider boundary", () => {
	let network: jest.SpyInstance;
	const settings = new ConfigService({
		AI_REVIEW_SERVICE_TOKEN: "test-only-token",
		REVIEW_ANALYSIS_PROVIDER: "gemini",
	});
	const provider = new PlanningProvider(settings, new DemandInsightsProvider(settings));
	beforeEach(() => {
		network = jest.spyOn(global, "fetch");
	});
	afterEach(() => network.mockRestore());
	it("hashes persisted JSONB config independently of key order", () => {
		const config = provider.configuration();
		const reordered = Object.fromEntries(Object.entries(config).reverse()) as typeof config;
		expect(planningConfigHash(config)).toBe(planningConfigHash(reordered));
		expect(planningConfigHash({ ...config, model: "other" })).not.toBe(planningConfigHash(config));
	});
	it("sends only released planning candidates, not internal source identities", async () => {
		network.mockResolvedValue(
			new Response(
				JSON.stringify({ recommendations: [{ candidateId: "c1", focusCodes: ["balanced_pace"] }] }),
				{ status: 200 }
			)
		);
		await provider.generate(
			"2026-07",
			candidates,
			provider.configuration(),
			new AbortController().signal
		);
		const [url, request] = network.mock.calls[0];
		expect(url).toBe("http://localhost:8000/demand-planning");
		expect(request.body).not.toMatch(/private-booker|private-host|private-booking/);
		expect(JSON.parse(request.body).prompt_version).toBe("planning-v1");
	});
	it.each([
		[422, "invalid_output", false],
		[429, "insufficient_quota", false],
		[403, "provider_failure", false],
		[429, "provider_failure", true],
		[504, "provider_transport", true],
	] as const)("classifies %s/%s safely", async (status, code, retryable) => {
		network.mockResolvedValue(
			new Response(JSON.stringify({ detail: { code, secret: "not exposed" } }), { status })
		);
		await expect(
			provider.generate(
				"2026-07",
				candidates,
				provider.configuration(),
				new AbortController().signal
			)
		).rejects.toMatchObject({ retryable });
	});
	it("rejects generated prices or combinations absent from frozen evidence", async () => {
		network.mockResolvedValue(
			new Response(
				JSON.stringify({
					recommendations: [{ candidateId: "c1", focusCodes: ["price_transparency"], price: 1 }],
				}),
				{ status: 200 }
			)
		);
		await expect(
			provider.generate(
				"2026-07",
				candidates,
				provider.configuration(),
				new AbortController().signal
			)
		).rejects.toMatchObject({ code: "invalid_output", retryable: false });
	});
});

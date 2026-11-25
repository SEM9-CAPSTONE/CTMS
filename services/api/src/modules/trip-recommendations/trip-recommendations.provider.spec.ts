import type { ConfigService } from "@nestjs/config";
import {
	type AiRecommendationRequest,
	RecommendationAiError,
	TripRecommendationsProvider,
} from "./trip-recommendations.provider";

const request = {
	prompt_version: "trip-recommendation-v2",
	model: "gpt-test",
	signal: "preferences",
	preferences: {
		activities: [],
		experienceYears: null,
		tripTypes: [],
		difficulties: [],
		regions: [],
		hasPriceRange: false,
	},
	history: { bookingCount: 0, tripType: {}, difficulty: {}, region: {}, priceBand: {} },
	candidates: [],
} as AiRecommendationRequest;

const provider = (env: Record<string, string | undefined>) =>
	new TripRecommendationsProvider({ get: (key: string) => env[key] } as unknown as ConfigService);

describe("TripRecommendationsProvider", () => {
	const fetchMock = jest.fn();
	beforeEach(() => {
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	it("reports no model when the token is missing or the feature is switched off", () => {
		expect(provider({}).modelVersion()).toBeNull();
		expect(
			provider({
				AI_REVIEW_SERVICE_TOKEN: "t",
				TRIP_RECOMMENDATION_AI_ENABLED: "false",
			}).modelVersion()
		).toBeNull();
		expect(provider({ AI_REVIEW_SERVICE_TOKEN: "t" }).modelVersion()).toBe("gemini-3.1-flash-lite");
		expect(
			provider({ AI_REVIEW_SERVICE_TOKEN: "t", TRIP_RECOMMENDATION_MODEL: "" }).modelVersion()
		).toBe("gemini-3.1-flash-lite");
	});

	it("isolates Gemini configuration from review analysis without an OpenAI fallback", () => {
		expect(
			provider({
				AI_REVIEW_SERVICE_TOKEN: "t",
				REVIEW_ANALYSIS_PROVIDER: "openai",
				REVIEW_ANALYSIS_MODEL: "gpt-review",
				TRIP_RECOMMENDATION_PROVIDER: "gemini",
			}).modelVersion()
		).toBe("gemini-3.1-flash-lite");
		expect(
			provider({
				AI_REVIEW_SERVICE_TOKEN: "t",
				TRIP_RECOMMENDATION_PROVIDER: "openai",
			}).modelVersion()
		).toBeNull();
	});

	it("posts to the internal endpoint with the service token and a 5 second limit", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ ranking: [] }), { status: 200 }));
		await expect(
			provider({ AI_REVIEW_SERVICE_TOKEN: "t", AI_SERVICE_URL: "http://ai:8000" }).rank(request)
		).resolves.toEqual({ ranking: [] });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("http://ai:8000/trip-recommendations");
		expect(init.headers["X-CTMS-AI-Token"]).toBe("t");
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it.each([
		[
			"timeout",
			() => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })),
			"ai_timeout",
		],
		["network", () => Promise.reject(new TypeError("fetch failed")), "ai_unavailable"],
		[
			"invalid output",
			() =>
				Promise.resolve(
					new Response(JSON.stringify({ detail: { code: "invalid_output" } }), { status: 422 })
				),
			"ai_invalid_output",
		],
		[
			"not configured",
			() =>
				Promise.resolve(
					new Response(JSON.stringify({ detail: { code: "provider_not_configured" } }), {
						status: 503,
					})
				),
			"ai_not_configured",
		],
		["gateway timeout", () => Promise.resolve(new Response("{}", { status: 504 })), "ai_timeout"],
		[
			"quota exhausted",
			() =>
				Promise.resolve(
					new Response(JSON.stringify({ detail: { code: "provider_rate_limited" } }), {
						status: 429,
						headers: { "Retry-After": "60" },
					})
				),
			"ai_unavailable",
		],
		[
			"server error",
			() => Promise.resolve(new Response("oops", { status: 502 })),
			"ai_unavailable",
		],
		[
			"non-JSON body",
			() => Promise.resolve(new Response("oops", { status: 200 })),
			"ai_invalid_output",
		],
	] as const)("maps %s to %s", async (_label, outcome, reason) => {
		fetchMock.mockImplementation(outcome);
		await expect(provider({ AI_REVIEW_SERVICE_TOKEN: "t" }).rank(request)).rejects.toEqual(
			new RecommendationAiError(reason)
		);
	});
});

import { ConfigService } from "@nestjs/config";
import { TripReviewModerationProvider } from "./trip-review-moderation.provider";

const sampleConfig = {
	provider: "gemini",
	model: "gemini-3.1-flash-lite",
	configVersion: "gemini-v1",
	promptVersion: "v1",
};

const sampleResponse = {
	text_scan_status: "completed",
	image_scan_status: "unsupported",
	aspects_status: "completed",
	incidents_status: "completed",
	flags: [],
	image_items: [],
	aspect_sentiments: [
		{ aspect: "scenery", sentiment: "positive", confidence: 0.95, quote: "Cảnh rất đẹp" },
	],
	incident_signals: [],
};

describe("TripReviewModerationProvider", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("resolves default configuration when environment variables are not provided", () => {
		const provider = new TripReviewModerationProvider(new ConfigService({}));
		expect(provider.configuration()).toEqual(sampleConfig);
	});

	it("overrides configuration when specific environment variables are set", () => {
		const provider = new TripReviewModerationProvider(
			new ConfigService({
				REVIEW_MODERATION_PROVIDER: "openai",
				REVIEW_MODERATION_MODEL: "gpt-4o-mini",
				REVIEW_MODERATION_CONFIG_VERSION: "openai-v2",
			})
		);
		expect(provider.configuration()).toEqual({
			provider: "openai",
			model: "gpt-4o-mini",
			configVersion: "openai-v2",
			promptVersion: "v1",
		});
	});

	it("throws non-retryable error if AI_REVIEW_SERVICE_TOKEN is missing", async () => {
		const provider = new TripReviewModerationProvider(new ConfigService({}));
		await expect(provider.scanReview("Nội dung", [], sampleConfig)).rejects.toMatchObject({
			code: "provider_not_configured",
			retryable: false,
		});
	});

	it("sends masked comment and image storage keys with authentication header", async () => {
		const provider = new TripReviewModerationProvider(
			new ConfigService({
				AI_SERVICE_URL: "http://localhost:8000",
				AI_REVIEW_SERVICE_TOKEN: "secret-token",
			})
		);

		const fetchSpy = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(sampleResponse), { status: 200 }));

		const res = await provider.scanReview("Đánh giá [email]", ["uploads/img1.jpg"], sampleConfig);

		expect(res).toEqual(sampleResponse);
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		const [url, options] = fetchSpy.mock.calls[0];
		expect(url).toBe("http://localhost:8000/review-moderation-scan");
		expect(options?.method).toBe("POST");
		expect(options?.headers).toMatchObject({
			"Content-Type": "application/json",
			"X-CTMS-AI-Token": "secret-token",
		});

		const body = JSON.parse(options?.body as string);
		expect(body).toEqual({
			comment: "Đánh giá [email]",
			images: ["uploads/img1.jpg"],
			provider: "gemini",
			model: "gemini-3.1-flash-lite",
			config_version: "gemini-v1",
			prompt_version: "v1",
		});
	});

	it.each([
		[400, false],
		[401, false],
		[422, false],
		[429, true],
		[500, true],
		[503, true],
	])("correctly classifies HTTP %s status code retryability", async (status, retryable) => {
		const provider = new TripReviewModerationProvider(
			new ConfigService({
				AI_SERVICE_URL: "http://localhost:8000",
				AI_REVIEW_SERVICE_TOKEN: "secret-token",
			})
		);

		jest
			.spyOn(global, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ detail: { code: "error_code" } }), { status })
			);

		await expect(provider.scanReview("Test", [], sampleConfig)).rejects.toMatchObject({
			code: "error_code",
			retryable,
		});
	});

	it("handles fetch abort as retryable provider_transport error", async () => {
		const provider = new TripReviewModerationProvider(
			new ConfigService({
				AI_SERVICE_URL: "http://localhost:8000",
				AI_REVIEW_SERVICE_TOKEN: "secret-token",
			})
		);

		const abortError = new Error("The operation was aborted");
		abortError.name = "AbortError";
		jest.spyOn(global, "fetch").mockRejectedValue(abortError);

		await expect(provider.scanReview("Test", [], sampleConfig)).rejects.toMatchObject({
			code: "provider_transport",
			retryable: true,
		});
	});
});

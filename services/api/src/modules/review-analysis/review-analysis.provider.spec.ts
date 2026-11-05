import { ConfigService } from "@nestjs/config";
import { ReviewAnalysisProvider } from "./review-analysis.provider";
const configuration = {
	provider: "openai",
	model: "test-model",
	configVersion: "v1",
	promptVersion: "v1",
};
const output = {
	sentiment: "positive",
	topics: ["scenery"],
	summary: "Great trip",
	confidence: 0.8,
	actualModel: "actual-model",
	requestId: null,
	usage: null,
};
describe("ReviewAnalysisProvider", () => {
	it("keeps Gemini results in a distinct provider configuration", () => {
		const adapter = new ReviewAnalysisProvider(
			new ConfigService({ REVIEW_ANALYSIS_PROVIDER: "gemini" })
		);
		expect(adapter.configuration()).toMatchObject({
			provider: "gemini",
			model: "gemini-3.1-flash-lite",
		});
	});
	it("rejects unsupported provider configuration", () => {
		const adapter = new ReviewAnalysisProvider(
			new ConfigService({ REVIEW_ANALYSIS_PROVIDER: "unknown" })
		);
		expect(() => adapter.configuration()).toThrow();
	});
	const provider = new ReviewAnalysisProvider(
		new ConfigService({
			AI_SERVICE_URL: "http://ai.internal",
			AI_REVIEW_SERVICE_TOKEN: "test-token",
		})
	);
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});
	it("sends only sanitized comment and run configuration, never source identity", async () => {
		const fetch = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(output), { status: 200 }));
		expect(await provider.generate("Beautiful trip", configuration)).toEqual(output);
		const options = fetch.mock.calls[0][1];
		expect(JSON.parse(options?.body as string)).toEqual({
			comment: "Beautiful trip",
			model: "test-model",
			config_version: "v1",
			prompt_version: "v1",
		});
		expect(options?.headers).toMatchObject({ "X-CTMS-AI-Token": "test-token" });
	});
	it.each([
		[400, false],
		[401, false],
		[403, false],
		[422, false],
		[429, true],
		[500, true],
		[503, true],
	])("classifies HTTP %s retryability", async (status, retryable) => {
		jest
			.spyOn(global, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ detail: { code: "provider_failure" } }), { status })
			);
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({ retryable });
	});
	it("treats missing provider configuration as terminal", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ detail: { code: "provider_not_configured" } }), {
				status: 503,
			})
		);
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "provider_not_configured",
			retryable: false,
		});
	});
	it("rejects malformed JSON and unknown taxonomy without retry", async () => {
		const fetch = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response("invalid JSON", { status: 200 }));
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "invalid_output",
			retryable: false,
		});
		fetch.mockResolvedValue(
			new Response(JSON.stringify({ ...output, topics: ["erase_review"] }), { status: 200 })
		);
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "invalid_output",
			retryable: false,
		});
	});
	it("enforces the request timeout", async () => {
		jest.useFakeTimers();
		jest
			.spyOn(global, "fetch")
			.mockImplementation(
				(_url, options) =>
					new Promise((_resolve, reject) =>
						options?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
					)
			);
		const result = expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "provider_timeout",
			retryable: true,
		});
		await jest.advanceTimersByTimeAsync(15001);
		await result;
	});
	it("does not request the provider without the internal shared secret", async () => {
		const fetch = jest.spyOn(global, "fetch");
		const unconfigured = new ReviewAnalysisProvider(new ConfigService());
		await expect(unconfigured.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "provider_not_configured",
			retryable: false,
		});
		expect(fetch).not.toHaveBeenCalled();
	});
	it("retries gateway HTML errors and transport failures but not successful malformed JSON", async () => {
		const fetch = jest
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			retryable: true,
		});
		fetch.mockRejectedValue(new Error("network failure containing unsafe details"));
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "provider_transport",
			retryable: true,
		});
	});
	it("does not retry exhausted API credits even though the HTTP status is 429", async () => {
		jest.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ detail: { code: "credit_balance_exhausted" } }), {
				status: 429,
			})
		);
		await expect(provider.generate("Tốt", configuration)).rejects.toMatchObject({
			code: "credit_balance_exhausted",
			retryable: false,
		});
	});
});

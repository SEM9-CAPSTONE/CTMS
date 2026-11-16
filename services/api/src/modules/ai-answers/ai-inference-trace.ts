export const TRACE_SCHEMA_VERSION = 1;
export const MODEL_IDENTIFIER = /^[\w.:/-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function record(value: unknown): Record<string, unknown> | undefined {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
}

function boundedInteger(value: unknown, min: number, max: number): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function stage(value: unknown) {
	const candidate = record(value);
	if (!candidate || Object.keys(candidate).length !== 2) return;
	const { promptSha256, maxOutputTokens } = candidate;
	if (
		typeof promptSha256 === "string" &&
		SHA256.test(promptSha256) &&
		boundedInteger(maxOutputTokens, 1, 32768)
	) {
		return { promptSha256, maxOutputTokens };
	}
}

/** Only accept allowlisted metadata from the private generation service. */
export function parseProviderInferenceTrace(value: unknown, provider: "openai" | "gemini") {
	const trace = record(value);
	if (!trace || Object.keys(trace).length !== 6) return;
	const { inferenceStartedAt, requestedModel, verificationModel } = trace;
	const draft = stage(trace.draft);
	const verification = stage(trace.verification);
	const configuration = record(trace.configuration);
	if (!configuration || Object.keys(configuration).length !== 6) return;
	const {
		outputTokenParameter,
		responseFormat,
		providerTimeoutMs,
		maxInputTokens,
		chatFormatReserve,
		maxPromptBytes,
	} = configuration;
	const tokenParameter = provider === "gemini" ? "max_tokens" : "max_completion_tokens";
	if (
		typeof inferenceStartedAt !== "string" ||
		!UTC_MILLISECONDS.test(inferenceStartedAt) ||
		!Number.isFinite(Date.parse(inferenceStartedAt)) ||
		new Date(inferenceStartedAt).toISOString() !== inferenceStartedAt ||
		typeof requestedModel !== "string" ||
		!MODEL_IDENTIFIER.test(requestedModel) ||
		(verificationModel !== null &&
			(typeof verificationModel !== "string" || !MODEL_IDENTIFIER.test(verificationModel))) ||
		!draft ||
		!verification ||
		outputTokenParameter !== tokenParameter ||
		responseFormat !== "json_object" ||
		!boundedInteger(providerTimeoutMs, 100, 7000) ||
		!boundedInteger(maxInputTokens, 1, 32768) ||
		!boundedInteger(chatFormatReserve, 0, maxInputTokens) ||
		!boundedInteger(maxPromptBytes, 1, 65536)
	)
		return;
	return {
		inferenceStartedAt,
		requestedModel,
		verificationModel,
		draft,
		verification,
		configuration: {
			outputTokenParameter,
			responseFormat,
			providerTimeoutMs,
			maxInputTokens,
			chatFormatReserve,
			maxPromptBytes,
		},
	};
}

export type ProviderInferenceTrace = NonNullable<ReturnType<typeof parseProviderInferenceTrace>>;

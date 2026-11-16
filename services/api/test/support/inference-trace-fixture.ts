export const providerInferenceTraceFixture = {
	inferenceStartedAt: "2026-11-16T01:00:00.000Z",
	requestedModel: "test-model",
	verificationModel: "test-verifier-revision",
	draft: { promptSha256: "a".repeat(64), maxOutputTokens: 512 },
	verification: { promptSha256: "b".repeat(64), maxOutputTokens: 64 },
	configuration: {
		outputTokenParameter: "max_completion_tokens",
		responseFormat: "json_object",
		providerTimeoutMs: 3000,
		maxInputTokens: 4096,
		chatFormatReserve: 64,
		maxPromptBytes: 18000,
	},
} as const;

export const localInferenceTraceFixture = {
	schemaVersion: 1,
	observedAt: "2026-11-16T01:00:00.000Z",
	path: "PRETRAINED",
	safetyPolicyVersion: "ctms-069-local-safety-v1",
	runtimeConfigVersion: "ctms-069-local-fllama-v1",
} as const;

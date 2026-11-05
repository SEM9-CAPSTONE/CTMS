import {
	type AnalysisOutput,
	AnalysisProviderError,
	SENTIMENTS,
	TOPICS,
} from "./review-analysis.types";

// Best-effort redaction; raw review evidence is never rewritten.
export function redactPersonalData(value: string): string {
	return value
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
		.replace(/(?<![\p{L}\p{N}])\+?\d[\d ().-]{6,}\d(?![\p{L}\p{N}])/gu, (match) => {
			const digits = match.replace(/\D/g, "").length;
			return digits >= 8 ? "[phone]" : match;
		});
}

export function validateOutput(raw: unknown): AnalysisOutput {
	const fail = (): never => {
		throw new AnalysisProviderError("invalid_output", false);
	};
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
	const value = raw as Record<string, unknown>;
	const keys = [
		"sentiment",
		"topics",
		"summary",
		"confidence",
		"actualModel",
		"requestId",
		"usage",
	];
	if (Object.keys(value).some((key) => !keys.includes(key))) return fail();
	if (
		!SENTIMENTS.includes(value.sentiment as (typeof SENTIMENTS)[number]) ||
		!Array.isArray(value.topics) ||
		value.topics.length > 5 ||
		new Set(value.topics).size !== value.topics.length ||
		value.topics.some((topic) => !TOPICS.includes(topic))
	)
		return fail();
	if (
		typeof value.summary !== "string" ||
		!value.summary.trim() ||
		[...value.summary].length > 500 ||
		typeof value.confidence !== "number" ||
		!Number.isFinite(value.confidence) ||
		value.confidence < 0 ||
		value.confidence > 1 ||
		typeof value.actualModel !== "string" ||
		!value.actualModel.trim() ||
		value.actualModel.length > 200 ||
		(value.requestId !== null &&
			(typeof value.requestId !== "string" || value.requestId.length > 200))
	)
		return fail();
	if (value.usage !== null) {
		if (!value.usage || typeof value.usage !== "object" || Array.isArray(value.usage))
			return fail();
		const usage = value.usage as Record<string, unknown>;
		if (
			Object.keys(usage).some((key) => !["inputTokens", "outputTokens"].includes(key)) ||
			!Number.isSafeInteger(usage.inputTokens) ||
			!Number.isSafeInteger(usage.outputTokens) ||
			(usage.inputTokens as number) < 0 ||
			(usage.outputTokens as number) < 0
		)
			return fail();
	}
	const result = value as unknown as AnalysisOutput;
	return { ...result, summary: [...redactPersonalData(result.summary)].slice(0, 500).join("") };
}

import { UnprocessableEntityException } from "@nestjs/common";
import { isISO8601, isUUID } from "class-validator";
import { MAX_QUERY_LENGTH } from "../rag/rag.types";
import { MAX_ANSWER_CHARS } from "./ai-answers.types";
import { TRACE_SCHEMA_VERSION } from "./ai-inference-trace";

export type FeedbackRating = "USEFUL" | "NOT_USEFUL";

const commonKeys = [
	"clientFeedbackId",
	"clientMutationId",
	"revision",
	"createdAt",
	"inferenceMode",
	"rating",
	"reportedUnsafe",
	"reportedAt",
	"reason",
];
const localKeys = [
	"installationId",
	"localAnswerId",
	"question",
	"answer",
	"modelId",
	"modelVersion",
	"packageId",
	"packageVersion",
	"localTrace",
];
const retentionMs = 30 * 24 * 60 * 60 * 1000;

function invalid(): never {
	throw new UnprocessableEntityException({ code: "AI_FEEDBACK_INVALID" });
}

function uuid(value: unknown) {
	if (typeof value !== "string" || !isUUID(value, "4")) invalid();
	return value.toLowerCase();
}

function positiveInteger(value: unknown) {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2147483647) {
		invalid();
	}
	return value;
}

function requiredText(value: unknown, limit: number) {
	if (
		typeof value !== "string" ||
		!value.trim() ||
		value.length > limit ||
		value.includes("\0") ||
		/[\uD800-\uDFFF]/u.test(value)
	) {
		invalid();
	}
	return value;
}

function optionalText(value: unknown, limit: number) {
	return value == null ? null : requiredText(value, limit);
}

function utcTimestamp(value: unknown): number {
	if (
		typeof value !== "string" ||
		!value.endsWith("Z") ||
		!isISO8601(value, { strict: true, strictSeparator: true })
	)
		invalid();
	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) invalid();
	return timestamp;
}

function parseLocalTrace(
	value: unknown,
	usesModel: boolean,
	usesPackage: boolean,
	hasPackageVersion: boolean
) {
	if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
	const payload = value as Record<string, unknown>;
	const { schemaVersion, observedAt, path, safetyPolicyVersion, runtimeConfigVersion } = payload;
	const hasRuntimeConfig = Object.hasOwn(payload, "runtimeConfigVersion");
	if (
		schemaVersion !== TRACE_SCHEMA_VERSION ||
		Object.keys(payload).length !== (hasRuntimeConfig ? 5 : 4) ||
		typeof safetyPolicyVersion !== "string" ||
		!/^ctms-069-local-safety-v[1-9]\d{0,3}$/.test(safetyPolicyVersion) ||
		(path !== "PRETRAINED" && path !== "SAVED_TRIP_CHECKPOINT_COUNT") ||
		(path === "PRETRAINED" && usesPackage) ||
		(path === "SAVED_TRIP_CHECKPOINT_COUNT" &&
			(usesModel || !hasPackageVersion || hasRuntimeConfig)) ||
		(hasRuntimeConfig &&
			(typeof runtimeConfigVersion !== "string" ||
				!/^ctms-069-local-fllama-v[1-9]\d{0,3}$/.test(runtimeConfigVersion)))
	)
		invalid();
	return {
		schemaVersion,
		observedAt: new Date(utcTimestamp(observedAt)).toISOString(),
		path,
		safetyPolicyVersion,
		...(hasRuntimeConfig ? { runtimeConfigVersion } : {}),
	};
}

export function feedbackInput(value: unknown, now = Date.now()) {
	if (typeof value !== "object" || !value || Array.isArray(value)) invalid();
	const body = value as Record<string, unknown>;
	const { inferenceMode, rating, reportedUnsafe, createdAt } = body;
	if (inferenceMode !== "ONLINE" && inferenceMode !== "LOCAL") invalid();
	const allowed = [...commonKeys, ...(inferenceMode === "ONLINE" ? ["answerId"] : localKeys)];
	if (Object.keys(body).some((key) => !allowed.includes(key))) invalid();
	if (
		typeof reportedUnsafe !== "boolean" ||
		(rating !== "USEFUL" && rating !== "NOT_USEFUL" && !(rating === null && reportedUnsafe))
	)
		invalid();
	const timestamp = utcTimestamp(createdAt);
	const reportedAt = body.reportedAt == null ? timestamp : utcTimestamp(body.reportedAt);
	if (
		timestamp < now - retentionMs ||
		timestamp > now + 5 * 60_000 ||
		(body.reportedAt != null &&
			(!reportedUnsafe || reportedAt > Math.min(now, timestamp) + 5 * 60_000))
	) {
		invalid();
	}
	const common = {
		clientFeedbackId: uuid(body.clientFeedbackId),
		clientMutationId: uuid(body.clientMutationId),
		createdAt: new Date(timestamp).toISOString(),
		revision: positiveInteger(body.revision),
		rating: rating as FeedbackRating | null,
		reportedUnsafe,
		reportedAt: reportedUnsafe ? new Date(reportedAt).toISOString() : null,
		reason: optionalText(body.reason, 1000),
	};
	if (inferenceMode === "ONLINE") {
		return { ...common, inferenceMode: "ONLINE" as const, answerId: uuid(body.answerId) };
	}
	const modelId = optionalText(body.modelId, 128);
	const modelVersion = optionalText(body.modelVersion, 128);
	const packageId = body.packageId == null ? null : uuid(body.packageId);
	const packageVersion = body.packageVersion == null ? null : positiveInteger(body.packageVersion);
	const localTrace = Object.hasOwn(body, "localTrace")
		? parseLocalTrace(
				body.localTrace,
				modelId !== null || modelVersion !== null,
				packageId !== null || packageVersion !== null,
				packageVersion !== null
			)
		: undefined;
	return {
		...common,
		inferenceMode: "LOCAL" as const,
		installationId: uuid(body.installationId),
		localAnswerId: uuid(body.localAnswerId),
		evidence: {
			question: requiredText(body.question, MAX_QUERY_LENGTH),
			answer: requiredText(body.answer, MAX_ANSWER_CHARS),
			modelId,
			modelVersion,
			packageId,
			packageVersion,
			...(localTrace ? { localTrace } : {}),
		},
	};
}

export type FeedbackInput = ReturnType<typeof feedbackInput>;

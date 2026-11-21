import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MODEL_IDENTIFIER } from "../ai-answers/ai-inference-trace";
import {
	AiInvestigationEvidence,
	snapshotContent,
	unmatchedCitation,
} from "./ai-investigation-evidence";
import {
	CasePriority,
	type Classification,
	type InvestigationReport,
	type Issue,
	type Job,
	type Snapshot,
	classifications,
} from "./ai-investigation.types";

const RESPONSE_MAX = 8192;
const INPUT_MAX = 16384;

function object(value: unknown, keys: string[]): Record<string, unknown> {
	if (
		!value ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		Object.keys(value).length !== keys.length ||
		!keys.every((key) => Object.hasOwn(value, key))
	) {
		throw new Error("Invalid investigation result shape");
	}
	return value as Record<string, unknown>;
}

function text(value: unknown, max: number) {
	if (
		typeof value !== "string" ||
		!value.trim() ||
		value.length > max ||
		value.includes("\0") ||
		/[\uD800-\uDFFF]/u.test(value)
	)
		throw new Error("Invalid investigation text");
	return value.trim();
}

function array<T>(value: unknown, max: number, parse: (item: unknown) => T): T[] {
	if (!Array.isArray(value) || value.length > max) throw new Error("Invalid investigation array");
	return value.map(parse);
}

export function parseInvestigationReport(
	value: unknown,
	availableEvidence: number[],
	contentEvidence = availableEvidence
): InvestigationReport {
	const payload = object(value, ["issues", "provider", "model"]);
	const { provider, model } = payload;
	if (
		(provider !== "openai" && provider !== "gemini") ||
		typeof model !== "string" ||
		!MODEL_IDENTIFIER.test(model)
	)
		throw new Error("Invalid investigation provider");
	const allowed = new Set(availableEvidence);
	const substantive = new Set(contentEvidence);
	const reference = (id: unknown) => {
		if (typeof id !== "number" || !allowed.has(id))
			throw new Error("Unknown investigation evidence");
		return id;
	};
	const issues = array(payload.issues, 3, (item): Issue => {
		const fields = object(item, [
			"classification",
			"observation",
			"suspectedCause",
			"supportingEvidence",
			"conflictingEvidence",
			"confidence",
			"uncertainty",
			"missingInformation",
			"proposedRemediation",
			"regressionCases",
		]);
		const classification = classifications.find((label) => label === fields.classification);
		if (!classification) throw new Error("Invalid issue classification");
		const { confidence, proposedRemediation } = fields;
		const suspectedCause = fields.suspectedCause === null ? null : text(fields.suspectedCause, 400);
		if (confidence !== "LOW" && confidence !== "MEDIUM" && confidence !== "HIGH")
			throw new Error("Invalid confidence");
		const supportingEvidence = array(fields.supportingEvidence, 10, reference);
		const conflictingEvidence = array(fields.conflictingEvidence, 10, reference);
		const allEvidence = [...supportingEvidence, ...conflictingEvidence];
		if (new Set(allEvidence).size !== allEvidence.length)
			throw new Error("Ambiguous investigation evidence");
		// This links observations to known artifacts. It does not verify a model's interpretation.
		const supported =
			classification !== "UNDETERMINED" &&
			supportingEvidence.some((id) => substantive.has(id)) &&
			conflictingEvidence.length === 0 &&
			confidence !== "LOW" &&
			suspectedCause !== null;
		return {
			classification: supported ? classification : "UNDETERMINED",
			observation: text(fields.observation, 500),
			suspectedCause: supported ? suspectedCause : null,
			supportingEvidence,
			conflictingEvidence,
			confidence: supported ? confidence : "LOW",
			uncertainty: text(fields.uncertainty, 300),
			missingInformation: array(fields.missingInformation, 3, (entry) => text(entry, 160)),
			proposedRemediation: proposedRemediation === null ? null : text(proposedRemediation, 400),
			regressionCases: array(fields.regressionCases, 2, (entry) => {
				const candidate = object(entry, ["scenario", "expected"]);
				return { scenario: text(candidate.scenario, 240), expected: text(candidate.expected, 240) };
			}),
		};
	});
	if (!issues.length) throw new Error("Investigation result requires an issue");
	return { issues, provider, model, consideredEvidence: availableEvidence };
}

export function unavailableIssue(): Issue {
	return {
		classification: "UNDETERMINED",
		observation: "Chưa có kết quả phân tích tự động.",
		suspectedCause: null,
		supportingEvidence: [],
		conflictingEvidence: [],
		confidence: "LOW",
		uncertainty: "Không thể xác định nguyên nhân khi thiếu kết quả phân tích.",
		missingInformation: ["Kết quả đối chiếu độc lập với dấu vết và nguồn có sẵn."],
		proposedRemediation: null,
		regressionCases: [],
	};
}

export function citationMismatchIssue(): Issue {
	return {
		classification: "SOURCE_MISMATCH",
		observation: "Dấu vết đã lưu có trích dẫn không thuộc tập bằng chứng truy xuất.",
		suspectedCause: null,
		supportingEvidence: [],
		conflictingEvidence: [],
		confidence: "HIGH",
		uncertainty:
			"Đã đối chiếu mã định danh trong dấu vết. Chưa xác định được nguyên nhân gây sai lệch.",
		missingInformation: ["Kết quả tái hiện bước lưu trích dẫn."],
		proposedRemediation: "Kiểm tra bước ghi nhận tập nguồn truy xuất và tập trích dẫn.",
		regressionCases: [
			{
				scenario: "Câu trả lời có trích dẫn ngoài tập truy xuất.",
				expected: "Tập trích dẫn chỉ chứa nguồn đã truy xuất.",
			},
		],
	};
}

export function groupKey(
	caseId: string,
	issueIndex: number,
	classification: Classification,
	snapshot: Snapshot
) {
	const mismatch =
		classification === "SOURCE_MISMATCH" && issueIndex === 0 && unmatchedCitation(snapshot);
	return mismatch
		? JSON.stringify(["recorded-citation-mismatch", ...mismatch])
		: `${caseId}:${issueIndex}:${classification}`;
}

@Injectable()
export class AiInvestigationAnalyzer {
	constructor(
		@Inject(ConfigService) private readonly config: ConfigService,
		@Inject(AiInvestigationEvidence) private readonly evidence: AiInvestigationEvidence
	) {}

	async analyze(job: Job, snapshot: Snapshot, reason: string | null): Promise<InvestigationReport> {
		const token = this.config.get<string>("AI_SURVIVAL_SERVICE_TOKEN")?.trim();
		if (!token || this.config.get<string>("AI_INVESTIGATION_PROVIDER_ENABLED") !== "true") {
			throw new Error("Investigation provider unavailable");
		}
		const sources = await this.evidence.resolve(
			snapshot,
			this.config.get<string>("AI_INVESTIGATION_SOURCE_EXCERPTS_ENABLED") === "true"
		);
		const turn = snapshotContent(snapshot);
		const observedMismatch = unmatchedCitation(snapshot) !== null;
		const input = {
			mode: snapshot.mode,
			question: turn.question,
			answer: turn.answer,
			rating: job.rating,
			unsafe: job.priority === CasePriority.UNSAFE,
			reason,
			trace: {
				provenance: turn.provenance,
				available: turn.trace !== null,
				modelId: turn.modelId,
				...(snapshot.mode === "ONLINE"
					? {
							retrievalConfigVersion: snapshot.online.retrieval_config_version ?? null,
							promptVersion: snapshot.online.generation?.promptVersion ?? null,
							responseLocale: snapshot.online.locale,
							safetyPolicyVersion: snapshot.online.generation?.trace?.safetyPolicyVersion ?? null,
						}
					: {
							localPath: snapshot.local.localTrace?.path ?? null,
							runtimeConfigVersion:
								snapshot.local.localTrace && "runtimeConfigVersion" in snapshot.local.localTrace
									? snapshot.local.localTrace.runtimeConfigVersion
									: null,
							safetyPolicyVersion: snapshot.local.localTrace?.safetyPolicyVersion ?? null,
							packageVersion: snapshot.local.packageVersion,
						}),
			},
			observedMismatch,
			sources: sources.map(({ evidenceId, cited, status, reference, excerpt }) => ({
				evidenceId,
				cited,
				status,
				...(reference
					? {
							title: reference.title.slice(0, 150),
							version: reference.version,
							classification: reference.classification,
							locale: reference.locale,
						}
					: {}),
				...(excerpt ? { excerpt } : {}),
			})),
		};
		let body = JSON.stringify(input);
		const includesExcerpts = Buffer.byteLength(body) <= INPUT_MAX;
		if (!includesExcerpts) {
			body = JSON.stringify({
				...input,
				sources: input.sources.map(({ excerpt: _excerpt, ...ref }) => ref),
			});
		}
		if (Buffer.byteLength(body) > INPUT_MAX) throw new Error("Investigation request exceeds limit");
		const base = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
		const response = await fetch(`${base.replace(/\/$/, "")}/internal/feedback-investigation`, {
			method: "POST",
			body,
			redirect: "error",
			signal: AbortSignal.timeout(12000),
			headers: { "Content-Type": "application/json", "X-CTMS-Survival-Token": token },
		});
		if (!response.ok || !response.body) {
			await response.body?.cancel();
			throw new Error("Investigation provider unavailable");
		}
		const buffers: Uint8Array[] = [];
		const reader = response.body.getReader();
		let length = 0;
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > RESPONSE_MAX) {
				await reader.cancel();
				throw new Error("Investigation response exceeds limit");
			}
			buffers.push(value);
		}
		const result = parseInvestigationReport(
			JSON.parse(Buffer.concat(buffers).toString("utf8")),
			sources.filter(({ status }) => status === "AVAILABLE").map(({ evidenceId }) => evidenceId),
			includesExcerpts
				? sources.filter(({ excerpt }) => excerpt).map(({ evidenceId }) => evidenceId)
				: []
		);
		if (observedMismatch) result.issues.unshift(citationMismatchIssue());
		return result;
	}
}

import { Injectable } from "@nestjs/common";
import { isUUID } from "class-validator";
import { citedEvidence, recordedInferenceTrace } from "../ai-answers/ai-answers.types";
// biome-ignore lint/style/useImportType: Nest injection
import { RagRepository } from "../rag/rag.repository";
import type { RagEvidenceRef } from "../rag/rag.types";
import type { Snapshot, SourceObservation } from "./ai-investigation.types";

const DIGEST = /^[a-f0-9]{64}$/;

export function snapshotContent(snapshot: Snapshot) {
	if (snapshot.mode === "LOCAL") {
		const { question, answer, localTrace, modelId, modelVersion, packageVersion, packageId } =
			snapshot.local;
		return {
			question,
			answer,
			provenance: "CLIENT_REPORTED" as const,
			initialSignal: snapshot.intake ?? null,
			trace: localTrace ?? null,
			modelId,
			modelVersion,
			packageVersion,
			packageId,
		};
	}
	const { question, answer, retrieval_config_version, generation } = snapshot.online;
	return {
		question: question ?? null,
		answer,
		provenance: "SERVER_RECORDED" as const,
		initialSignal: snapshot.intake ?? null,
		trace: recordedInferenceTrace(snapshot.online),
		retrievalConfigVersion: retrieval_config_version ?? null,
		provider: generation?.provider ?? null,
		modelId: generation?.model ?? null,
		promptVersion: generation?.promptVersion ?? null,
	};
}

function usableReference(ref: RagEvidenceRef) {
	return (
		typeof ref.fingerprint === "string" &&
		DIGEST.test(ref.fingerprint) &&
		typeof ref.source.checksum === "string" &&
		DIGEST.test(ref.source.checksum)
	);
}

export function recordedEvidence(snapshot: Snapshot) {
	if (snapshot.mode === "LOCAL") return [];
	const online = snapshot.online;
	const retrieved = Array.isArray(online.retrieved_evidence) ? online.retrieved_evidence : [];
	const cited = new Set(online.cited_chunk_ids ?? []);
	const valid = new Map(
		citedEvidence({
			...online,
			id: "",
			request_hash: "",
			cited_chunk_ids: retrieved.flatMap((ref) => (ref?.chunkId ? [ref.chunkId] : [])),
		})
			.filter(usableReference)
			.map((ref) => [ref.chunkId, ref])
	);
	const chunkIds = [...new Set([...retrieved.map((ref) => ref?.chunkId), ...cited])];
	return chunkIds.map((chunkId, index) => ({
		evidenceId: index + 1,
		cited: cited.has(chunkId),
		ref: valid.get(chunkId),
	}));
}

export function unmatchedCitation(snapshot: Snapshot) {
	if (snapshot.mode !== "ONLINE" || !recordedInferenceTrace(snapshot.online)) return null;
	const { retrieved_evidence, cited_chunk_ids, retrieval_config_version, generation } =
		snapshot.online;
	if (
		!retrieval_config_version ||
		!generation?.promptVersion ||
		!Array.isArray(retrieved_evidence) ||
		!retrieved_evidence.length ||
		recordedEvidence(snapshot).filter(({ ref }) => ref).length !== retrieved_evidence.length
	)
		return null;
	const retrieved = new Set(retrieved_evidence.map((ref) => ref.chunkId));
	const missing = cited_chunk_ids.filter((id) => isUUID(id) && !retrieved.has(id)).sort();
	if (!missing.length) return null;
	return [retrieval_config_version, generation.promptVersion, ...missing];
}

@Injectable()
export class AiInvestigationEvidence {
	constructor(private readonly rag: RagRepository) {}

	async resolve(snapshot: Snapshot, includeExcerpts = false) {
		if (snapshot.mode === "LOCAL") return [];
		const recorded = recordedEvidence(snapshot);
		const chunks = await this.rag.resolveInvestigationEvidence(
			recorded.flatMap(({ ref }) => (ref ? [ref] : [])),
			snapshot.online.locale
		);
		const byChunk = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));
		return recorded.map(({ evidenceId, cited, ref }): SourceObservation & { excerpt?: string } => {
			const chunk = ref && byChunk.get(ref.chunkId);
			if (!ref || !chunk) return { evidenceId, cited, status: "UNAVAILABLE" };
			return {
				evidenceId,
				cited,
				status: "AVAILABLE",
				reference: {
					documentId: chunk.source.documentId,
					documentVersionId: chunk.source.documentVersionId,
					chunkSetId: chunk.source.chunkSetId,
					chunkId: chunk.chunkId,
					version: chunk.source.sourceVersion,
					title: chunk.source.sourceTitle,
					checksum: chunk.source.checksum,
					classification: chunk.source.classification,
					chunkIndex: ref.chunkIndex,
					locations: ref.locations,
					fingerprint: ref.fingerprint,
				},
				...(includeExcerpts ? { excerpt: [...chunk.content].slice(0, 360).join("") } : {}),
			};
		});
	}
}

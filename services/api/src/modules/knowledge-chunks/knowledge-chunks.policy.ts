import {
	type ChunkOutput,
	type ChunkSet,
	IngestionError,
	MAX_CHUNKS,
} from "./knowledge-chunks.types";

/** Treat the Python response as untrusted; never accept mismatched provenance or partial vectors. */
export function validateChunkOutput(raw: unknown, set: ChunkSet): ChunkOutput {
	const invalid = () => {
		throw new IngestionError("invalid_ingestion_output");
	};
	if (!raw || typeof raw !== "object") return invalid();
	const value = raw as ChunkOutput;
	if (
		value.document_version_id !== set.document_version_id ||
		value.source_version !== set.source_version ||
		value.checksum !== set.checksum ||
		value.locale !== set.locale ||
		!value.configuration ||
		Object.entries(set.configuration).some(
			([key, item]) => (value.configuration as unknown as Record<string, unknown>)[key] !== item
		)
	)
		return invalid();
	if (
		!value.quality ||
		!["PASSED", "NEEDS_REVIEW"].includes(value.quality.status) ||
		!Array.isArray(value.quality.issues) ||
		value.quality.issues.some((issue) => typeof issue !== "string") ||
		!Number.isInteger(value.quality.page_count) ||
		value.quality.page_count < 1 ||
		!Array.isArray(value.chunks)
	)
		return invalid();
	if (value.quality.status === "NEEDS_REVIEW") {
		if (!value.quality.issues.length || value.chunks.length) return invalid();
		return value;
	}
	if (value.quality.issues.length || !value.chunks.length || value.chunks.length > MAX_CHUNKS)
		return invalid();
	for (const [index, chunk] of value.chunks.entries()) {
		if (
			!chunk ||
			chunk.chunk_index !== index ||
			typeof chunk.content !== "string" ||
			!chunk.content.trim() ||
			typeof chunk.embedding_text !== "string" ||
			!chunk.embedding_text.includes(chunk.content) ||
			!Number.isInteger(chunk.token_count) ||
			chunk.token_count < 1 ||
			chunk.token_count > set.configuration.max_tokens ||
			!Array.isArray(chunk.headings) ||
			chunk.headings.some((heading) => typeof heading !== "string") ||
			!Array.isArray(chunk.locations) ||
			!chunk.locations.length ||
			!Array.isArray(chunk.embedding) ||
			chunk.embedding.length !== set.configuration.embedding_dimensions ||
			chunk.embedding.some((item) => typeof item !== "number" || !Number.isFinite(item)) ||
			!chunk.embedding.some((item) => item !== 0)
		)
			return invalid();
		for (const location of chunk.locations) {
			if (
				!location ||
				!Number.isInteger(location.page) ||
				location.page < 1 ||
				location.page > value.quality.page_count ||
				typeof location.item_ref !== "string" ||
				!location.item_ref ||
				!location.bbox ||
				![location.bbox.l, location.bbox.t, location.bbox.r, location.bbox.b].every(
					Number.isFinite
				) ||
				!["TOPLEFT", "BOTTOMLEFT"].includes(location.bbox.coord_origin)
			)
				return invalid();
		}
	}
	return value;
}

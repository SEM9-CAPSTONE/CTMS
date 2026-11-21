import {
	type ChunkOutput,
	type ChunkSet,
	IngestionError,
	MAX_CHUNKS,
	type PreparedChunkOutput,
} from "./knowledge-chunks.types";

export function isValidEmbedding(vector: unknown, dimensions: number): vector is number[] {
	return (
		Array.isArray(vector) &&
		vector.length === dimensions &&
		vector.every((item) => typeof item === "number" && Number.isFinite(item)) &&
		vector.some((item) => item !== 0)
	);
}

function canonicalJson(value: unknown): string | undefined {
	return JSON.stringify(value, (_key, item: unknown) =>
		item && typeof item === "object" && !Array.isArray(item)
			? Object.fromEntries(
					Object.keys(item)
						.sort()
						.map((key) => [key, (item as Record<string, unknown>)[key]])
				)
			: item
	);
}

/** Validate extraction before any lookup or model call. */
export function validatePreparedChunkOutput(raw: unknown, set: ChunkSet): PreparedChunkOutput {
	const invalid = () => {
		throw new IngestionError("invalid_ingestion_output");
	};
	if (!raw || typeof raw !== "object") return invalid();
	const value = raw as PreparedChunkOutput;
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
	if (value.quality.pages !== undefined) {
		const pages = value.quality.pages;
		if (!Array.isArray(pages) || pages.length !== value.quality.page_count) return invalid();
		for (const [index, page] of pages.entries()) {
			if (
				!page ||
				page.page !== index + 1 ||
				!["native", "ocr", "mixed", "blank", "unverified", "manual"].includes(page.mode) ||
				!Number.isInteger(page.ocr_words) ||
				page.ocr_words < 0 ||
				[page.minimum_confidence, page.text_coverage].some(
					(score) => score !== null && (!Number.isFinite(score) || score < 0 || score > 1)
				) ||
				!Array.isArray(page.issues) ||
				page.issues.some((issue) => typeof issue !== "string") ||
				(value.quality.status === "PASSED" && (page.issues.length || page.mode === "unverified"))
			)
				return invalid();
			if (
				page.mode === "manual" &&
				!value.quality.integrity?.regions.some(
					(region) =>
						region.page === page.page &&
						region.decision?.source_checked === true &&
						region.decision.context_checked === true
				)
			)
				return invalid();
		}
	}
	if (
		set.configuration.pipeline_version === "ctms-content-integrity-v5" &&
		value.quality.status === "PASSED"
	) {
		const snapshot = value.extraction_snapshot;
		const integrity = value.quality.integrity;
		if (
			!snapshot ||
			snapshot.format !== 1 ||
			snapshot.document_version_id !== set.document_version_id ||
			snapshot.checksum !== set.checksum ||
			!snapshot.document ||
			!Array.isArray(snapshot.regions) ||
			!Array.isArray(snapshot.prepared) ||
			!Number.isSafeInteger(snapshot.revision) ||
			snapshot.revision < 0 ||
			!snapshot.configuration ||
			Object.entries(set.configuration).some(
				([key, item]) =>
					(snapshot.configuration as unknown as Record<string, unknown>)[key] !== item
			) ||
			!integrity ||
			!Array.isArray(integrity.regions) ||
			integrity.revision !== snapshot.revision ||
			integrity.regions.length !== snapshot.regions.length
		)
			return invalid();
		if (
			snapshot.regions.some(
				(region, index) =>
					!region ||
					!/^[a-f0-9]{64}$/.test(region.id) ||
					!Number.isInteger(region.page) ||
					region.page < 1 ||
					region.page > value.quality.page_count ||
					!Array.isArray(region.item_refs) ||
					!Array.isArray(region.issues) ||
					!region.bbox ||
					![region.bbox.l, region.bbox.t, region.bbox.r, region.bbox.b].every(Number.isFinite) ||
					integrity.regions[index]?.id !== region.id
			)
		)
			return invalid();
		if (
			value.quality.status === "PASSED" &&
			(integrity.complete !== true ||
				snapshot.regions.some((region) => !region.decision && region.assessment !== "verified"))
		)
			return invalid();
		// This is JSON evidence from HTTP/JSONB. Property order and the JS realm
		// that parsed it cannot change content eligibility; every value must match.
		if (
			canonicalJson(snapshot.prepared) !==
			canonicalJson(
				value.chunks.map(
					(chunk) =>
						chunk && {
							chunk_index: chunk.chunk_index,
							content: chunk.content,
							embedding_text: chunk.embedding_text,
							token_count: chunk.token_count,
							headings: chunk.headings,
							locations: chunk.locations,
						}
				)
			)
		)
			return invalid();
		const previous = set.extraction_snapshot;
		if (
			previous &&
			(snapshot.revision !== previous.revision ||
				previous.regions.some((region) => {
					const next = snapshot.regions.find((item) => item.id === region.id);
					return !next || JSON.stringify(next.decision) !== JSON.stringify(region.decision);
				}))
		)
			return invalid();
	}
	if (value.quality.status === "NEEDS_REVIEW") {
		if (!value.quality.issues.length || value.chunks.length) return invalid();
		return value;
	}
	if (
		value.quality.integrity &&
		(value.quality.integrity.complete !== true ||
			value.quality.integrity.regions.some(
				(region) => !region.decision && region.assessment !== "verified"
			))
	)
		return invalid();
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
			!chunk.locations.length
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

export function validateChunkOutput(raw: unknown, set: ChunkSet): ChunkOutput {
	const value = validatePreparedChunkOutput(raw, set) as ChunkOutput;
	if (
		value.chunks.some(
			({ embedding }) => !isValidEmbedding(embedding, set.configuration.embedding_dimensions)
		)
	) {
		throw new IngestionError("invalid_ingestion_output");
	}
	return value;
}

import type {
	ChunkSet,
	PreparedChunk,
	PreparedChunkOutput,
} from "../../src/modules/knowledge-chunks/knowledge-chunks.types";

/** Test evidence uses a text-only verified source; never marks runtime PDFs reviewed. */
export function integrityFixture(
	set: Pick<ChunkSet, "document_version_id" | "checksum" | "configuration">,
	prepared: PreparedChunk[] = []
) {
	return {
		format: 1,
		document_version_id: set.document_version_id,
		checksum: set.checksum,
		configuration: { ...set.configuration },
		revision: 0,
		document: { name: "Text-only fixture" },
		regions: [],
		prepared,
	};
}
export const verifiedIntegrity = { revision: 0, complete: true, regions: [] };
export function withIntegrity<T extends PreparedChunkOutput>(output: T): T {
	return {
		...output,
		quality: {
			...output.quality,
			integrity: { ...verifiedIntegrity, complete: output.quality.status === "PASSED" },
		},
		extraction_snapshot: integrityFixture(
			output,
			output.chunks.map(
				({ chunk_index, content, embedding_text, token_count, headings, locations }) => ({
					chunk_index,
					content,
					embedding_text,
					token_count,
					headings,
					locations,
				})
			)
		),
	};
}

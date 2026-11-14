import { createHash } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { chunkConfiguration, ChunkSetStatus, MAX_TOKENS } from "../knowledge-chunks/knowledge-chunks.types";
import { isEligiblePublishedSource } from "../survival-documents/source-policy";
import {
	DocumentStatus,
	type SourceVersion,
	VERSION_SELECT,
} from "../survival-documents/survival-documents.types";
import type { RagSettings } from "./rag.config";
import { MAX_BLOCK_BYTES, type RagChunk, type RagSource } from "./rag.types";

const MAX_PAGE_COUNT = 1000;
const MAX_RANKED_ROWS = 128;
const EMBEDDING = chunkConfiguration();
const CONFIG_HASH = createHash("sha256").update(JSON.stringify(EMBEDDING)).digest("hex");

interface Publication extends SourceVersion {
	chunkSetId: string;
	configHash: string;
	chunkCount: number;
	pageCount: number;
}

interface CandidateRow {
	id: string;
	chunk_set_id: string;
	chunk_index: number;
	content: string;
	metadata: Record<string, unknown>;
	score: number;
}

function asChunk(row: CandidateRow, publication: Publication, source: RagSource): RagChunk | null {
	const { headings, locations, source_title, token_count } = row.metadata ?? {};
	if (
		!Number.isFinite(row.score) ||
		!row.content.trim() ||
		source_title !== source.sourceTitle ||
		typeof token_count !== "number" ||
		!Number.isInteger(token_count) ||
		token_count < 1 ||
		token_count > MAX_TOKENS ||
		!Array.isArray(headings) ||
		!headings.every((heading) => typeof heading === "string") ||
		!Array.isArray(locations) ||
		!locations.length
	) {
		return null;
	}
	const references = new Map<string, { page: number; itemRef: string }>();
	for (const location of locations) {
		if (
			!location ||
			!Number.isInteger(location.page) ||
			location.page < 1 ||
			location.page > publication.pageCount ||
			typeof location.item_ref !== "string" ||
			!location.item_ref.trim()
		) {
			return null;
		}
		references.set(`${location.page}:${location.item_ref}`, {
			page: location.page,
			itemRef: location.item_ref,
		});
	}
	return {
		chunkId: row.id,
		chunkIndex: row.chunk_index,
		source,
		locations: [...references.values()],
		headings,
		content: row.content,
		score: row.score,
	};
}

function toSource(version: Publication): RagSource {
	return {
		documentId: version.documentId,
		documentVersionId: version.id,
		sourceVersion: version.versionNumber,
		checksum: version.checksum,
		chunkSetId: version.chunkSetId,
		locale: version.metadata.locale,
		sourceTitle: version.metadata.sourceTitle,
		classification: version.metadata.classification,
		...(version.metadata.publisher ? { publisher: version.metadata.publisher } : {}),
		embeddingModel: EMBEDDING.embedding_model,
		embeddingRevision: EMBEDDING.embedding_revision,
		embeddingDimensions: EMBEDDING.embedding_dimensions,
		pipelineVersion: EMBEDDING.pipeline_version,
		configHash: version.configHash,
	};
}

@Injectable()
export class RagRepository {
	constructor(private readonly db: DataSource) {}

	async hasEligibleCorpus(locale: string, settings: RagSettings): Promise<boolean> {
		return this.read(settings.databaseTimeoutMs, async (manager) => {
			const { candidateCount } = await this.boundedCorpus(manager, locale, settings.maxCandidates);
			return candidateCount > 0;
		});
	}

	/** Read a single corpus snapshot. Embeddings stay in PostgreSQL. */
	async search(locale: string, embedding: number[], settings: RagSettings) {
		return this.read(settings.databaseTimeoutMs, async (manager) => {
			const { publications, candidateCount } = await this.boundedCorpus(
				manager,
				locale,
				settings.maxCandidates
			);
			if (!candidateCount) return { candidates: [], candidateCount };
			const bySet = new Map(publications.map((set) => [set.chunkSetId, set]));
			const sources = new Map(publications.map((set) => [set.chunkSetId, toSource(set)]));
			const rows: CandidateRow[] = await manager.query(
				`WITH expected AS (
					SELECT * FROM unnest($1::uuid[], $2::int[]) AS s(id, chunk_count)
				), complete_sets AS MATERIALIZED (
					SELECT s.id FROM expected s JOIN knowledge_chunks c ON c.chunk_set_id=s.id
					GROUP BY s.id,s.chunk_count
					HAVING count(*)=s.chunk_count AND min(c.chunk_index)=0 AND max(c.chunk_index)=s.chunk_count-1
				), eligible_chunks AS MATERIALIZED (
					SELECT c.id,c.chunk_set_id,c.chunk_index,c.content,c.metadata,c.embedding
					FROM complete_sets s JOIN knowledge_chunks c ON c.chunk_set_id=s.id
					WHERE array_ndims(c.embedding)=1 AND cardinality(c.embedding)=$4
						AND octet_length(c.content)<=$5 AND octet_length(c.metadata::text)<=$5
				)
				SELECT c.id,c.chunk_set_id,c.chunk_index,c.content,c.metadata,
					least(1::float8,similarity.score) AS score
				FROM eligible_chunks c
				CROSS JOIN LATERAL (
					SELECT sum(e.value * ($3::float8[])[e.ord::int]) FILTER (WHERE abs(e.value)<=1.001)
						/ nullif($8::float8 * sqrt(sum(e.value * e.value) FILTER (WHERE abs(e.value)<=1.001)),0) AS score
					FROM unnest(c.embedding) WITH ORDINALITY AS e(value,ord)
					HAVING count(*)=$4 AND count(*) FILTER (WHERE abs(e.value)<=1.001)=$4
				) similarity
				WHERE similarity.score >= $6
				ORDER BY score DESC,c.chunk_set_id,c.chunk_index,c.id
				LIMIT $7`,
				[
					publications.map((set) => set.chunkSetId),
					publications.map((set) => set.chunkCount),
					embedding,
					EMBEDDING.embedding_dimensions,
					MAX_BLOCK_BYTES,
					settings.minScore,
					Math.min(settings.maxCandidates, MAX_RANKED_ROWS),
					Math.hypot(...embedding),
				]
			);
			const candidates = rows.flatMap((row) => {
				const set = bySet.get(row.chunk_set_id);
				const source = sources.get(row.chunk_set_id);
				const chunk = set && source && asChunk(row, set, source);
				return chunk ? [chunk] : [];
			});
			return { candidates, candidateCount };
		});
	}

	/** A fresh snapshot after token counting is the final eligibility decision point. */
	async revalidate(
		chunks: RagChunk[],
		locale: string,
		timeoutMs: number
	): Promise<"CURRENT" | "SOURCE_CHANGED" | "INCOMPLETE_EVIDENCE"> {
		return this.read(timeoutMs, async (manager) => {
			const documentIds = [...new Set(chunks.map((chunk) => chunk.source.documentId))];
			const current = await this.publications(
				manager,
				locale,
				documentIds.length,
				documentIds
			);
			const chunkIds = chunks.map((chunk) => chunk.chunkId);
			const bySet = new Map(current.map((set) => [set.chunkSetId, set]));
			const rows: Omit<CandidateRow, "score">[] = await manager.query(
				`SELECT id,chunk_set_id,chunk_index,content,metadata
				FROM knowledge_chunks WHERE id=ANY($1::uuid[]) AND chunk_set_id=ANY($2::uuid[])
					AND octet_length(content)<=$3 AND octet_length(metadata::text)<=$3`,
				[chunkIds, [...bySet.keys()], MAX_BLOCK_BYTES]
			);
			const byChunk = new Map(rows.map((row) => [row.id, row]));
			const unchanged = chunks.every((chunk) => {
				const row = byChunk.get(chunk.chunkId);
				const set = row && bySet.get(row.chunk_set_id);
				if (!row || !set) return false;
				const rechecked = asChunk({ ...row, score: chunk.score }, set, toSource(set));
				return JSON.stringify(rechecked) === JSON.stringify(chunk);
			});
			if (!unchanged) return "SOURCE_CHANGED";

			// An upstream PDF item can span several chunks. Do not return a partial item as evidence.
			const itemSets = new Map<string, Set<string>>();
			for (const { source, locations } of chunks) {
				const refs = itemSets.get(source.chunkSetId) ?? new Set<string>();
				for (const { itemRef } of locations) refs.add(itemRef);
				itemSets.set(source.chunkSetId, refs);
			}
			const sets = current.map((set) => ({
				id: set.chunkSetId,
				chunk_count: set.chunkCount,
				refs: [...(itemSets.get(set.chunkSetId) ?? [])],
			}));
			const [check]: Array<{ valid: boolean; partial: boolean }> = await manager.query(
				`WITH expected AS (
					SELECT * FROM jsonb_to_recordset($1::jsonb) AS s(id uuid, chunk_count int, refs jsonb)
				), checked AS (
					SELECT count(c.id)=s.chunk_count AND min(c.chunk_index)=0
						AND max(c.chunk_index)=s.chunk_count-1 AS complete,
						bool_or(c.id<>ALL($2::uuid[]) AND EXISTS (
							SELECT 1 FROM jsonb_array_elements(
								CASE WHEN jsonb_typeof(c.metadata->'locations')='array'
									THEN c.metadata->'locations' ELSE '[]'::jsonb END
							) AS l(location) WHERE s.refs ? (l.location->>'item_ref')
						)) AS partial
					FROM expected s LEFT JOIN knowledge_chunks c ON c.chunk_set_id=s.id
					GROUP BY s.id,s.chunk_count,s.refs
				)
				SELECT bool_and(complete) AS valid, coalesce(bool_or(partial),false) AS partial FROM checked`,
				[JSON.stringify(sets), chunkIds]
			);
			if (!check.valid) return "SOURCE_CHANGED";
			return check.partial ? "INCOMPLETE_EVIDENCE" : "CURRENT";
		});
	}

	private async read<T>(timeoutMs: number, query: (manager: EntityManager) => Promise<T>): Promise<T> {
		try {
			return await this.db.transaction("REPEATABLE READ", async (manager) => {
				await manager.query("SET TRANSACTION READ ONLY");
				await manager.query("SELECT set_config('statement_timeout',$1,true)", [String(timeoutMs)]);
				return query(manager);
			});
		} catch (error) {
			if (error instanceof ServiceUnavailableException) throw error;
			throw new ServiceUnavailableException({ code: "RAG_DATABASE_UNAVAILABLE" });
		}
	}

	private async boundedCorpus(manager: EntityManager, locale: string, maxCandidates: number) {
		const publications = await this.publications(manager, locale, maxCandidates + 1);
		const candidateCount = publications.reduce((count, set) => count + set.chunkCount, 0);
		if (candidateCount > maxCandidates) {
			throw new ServiceUnavailableException({ code: "RAG_CORPUS_LIMIT" });
		}
		return { publications, candidateCount };
	}

	private async publications(
		manager: EntityManager,
		locale: string,
		limit: number,
		documentIds: string[] | null = null
	): Promise<Publication[]> {
		const rows: Publication[] = await manager.query(
			`SELECT v.*,s.id AS "chunkSetId",s.config_hash AS "configHash",s.chunk_count AS "chunkCount",
				s.quality_report->'page_count' AS "pageCount"
			FROM knowledge_chunk_publications p
			JOIN survival_documents d ON d.id=p.document_id
			JOIN knowledge_chunk_sets s ON s.id=p.chunk_set_id AND s.document_id=d.id
			JOIN (${VERSION_SELECT}) v ON v.id=d.current_published_version_id AND v."documentId"=d.id
			WHERE v.status=$1 AND v."publishedAt" IS NOT NULL AND s.status=$2
				AND s.document_version_id=v.id AND s.source_version=v."versionNumber"
				AND s.checksum=v.checksum AND s.locale=v.metadata->>'locale' AND s.locale=$3
				AND s.configuration=$4::jsonb
				AND s.quality_report->>'status'='PASSED' AND s.quality_report->'issues'='[]'::jsonb
				AND ($5::uuid[] IS NULL OR d.id=ANY($5))
			ORDER BY d.id LIMIT $6`,
			[DocumentStatus.PUBLISHED, ChunkSetStatus.READY, locale, JSON.stringify(EMBEDDING), documentIds, limit]
		);
		if (!documentIds && rows.length === limit) {
			throw new ServiceUnavailableException({ code: "RAG_CORPUS_LIMIT" });
		}
		return rows.filter(
			(version) =>
				isEligiblePublishedSource(version, version.id) &&
				version.configHash === CONFIG_HASH &&
				Number.isInteger(version.pageCount) &&
				version.pageCount >= 1 &&
				version.pageCount <= MAX_PAGE_COUNT &&
				Number.isInteger(version.chunkCount) &&
				version.chunkCount >= 1
		);
	}
}

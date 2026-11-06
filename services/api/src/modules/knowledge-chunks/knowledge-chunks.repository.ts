import { createHash, randomUUID } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { type SourceVersion, VERSION_SELECT } from "../survival-documents/survival-documents.types";
import { eligibleSource, validateChunkOutput } from "./knowledge-chunks.policy";
import {
	type ChunkConfiguration,
	type ChunkOutput,
	type ChunkSet,
	ChunkSetStatus,
	type ChunkSetSummary,
	LEASE_SECONDS,
	MAX_ATTEMPTS,
	type StoredKnowledgeChunk,
} from "./knowledge-chunks.types";

@Injectable()
export class KnowledgeChunksRepository {
	constructor(readonly db: DataSource) {}

	private async source(
		manager: EntityManager,
		documentId: string,
		versionId: string
	): Promise<SourceVersion | null> {
		// Publication, archive, deletion and commit serialize on the same document row.
		const [document]: Array<{ current_published_version_id: string | null }> = await manager.query(
			"SELECT current_published_version_id FROM survival_documents WHERE id=$1 FOR UPDATE",
			[documentId]
		);
		if (!document) return null;
		const [version]: SourceVersion[] = await manager.query(
			`${VERSION_SELECT} WHERE document_id=$1 AND id=$2`,
			[documentId, versionId]
		);
		return version && eligibleSource(version, document.current_published_version_id)
			? version
			: null;
	}

	private async insert(
		manager: EntityManager,
		version: SourceVersion,
		configuration: ChunkConfiguration
	): Promise<ChunkSet> {
		const hash = createHash("sha256").update(JSON.stringify(configuration)).digest("hex");
		await manager.query(
			`INSERT INTO knowledge_chunk_sets(document_id,document_version_id,source_version,checksum,locale,configuration,config_hash)
		 VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(document_version_id,config_hash) DO NOTHING`,
			[
				version.documentId,
				version.id,
				version.versionNumber,
				version.checksum,
				version.metadata.locale,
				JSON.stringify(configuration),
				hash,
			]
		);
		const [set]: ChunkSet[] = await manager.query(
			"SELECT * FROM knowledge_chunk_sets WHERE document_version_id=$1 AND config_hash=$2",
			[version.id, hash]
		);
		return set;
	}

	async enqueue(
		documentId: string,
		versionId: string,
		configuration: ChunkConfiguration
	): Promise<ChunkSet> {
		return this.db.transaction(async (manager) => {
			const source = await this.source(manager, documentId, versionId);
			if (!source) throw new ConflictException({ code: "KNOWLEDGE_SOURCE_INELIGIBLE" });
			const set = await this.insert(manager, source, configuration);
			// An explicit request retries failed work; READY and in-flight sets remain idempotent.
			await manager.query(
				`UPDATE knowledge_chunk_sets SET status='PENDING',attempts=0,error_code=NULL,
			 quality_report=NULL,completed_at=NULL,next_attempt_at=now() WHERE id=$1 AND status IN ('FAILED','NEEDS_REVIEW')`,
				[set.id]
			);
			const [current]: ChunkSet[] = await manager.query(
				"SELECT * FROM knowledge_chunk_sets WHERE id=$1",
				[set.id]
			);
			return current;
		});
	}

	async consumeEvents(configuration: ChunkConfiguration): Promise<void> {
		await this.db.transaction(async (manager) => {
			const events: Array<{
				id: string;
				document_id: string;
				version_id: string;
				event_type: string;
				payload: { regenerationNeeded?: boolean };
			}> = await manager.query(`
			 SELECT e.* FROM survival_document_outbox e WHERE NOT EXISTS
			 (SELECT 1 FROM knowledge_chunk_event_receipts r WHERE r.event_id=e.id)
			 ORDER BY e.created_at,e.id FOR UPDATE OF e SKIP LOCKED LIMIT 20`);
			for (const event of events) {
				if (
					event.event_type === "published_version_changed" &&
					event.payload.regenerationNeeded === true
				) {
					const source = await this.source(manager, event.document_id, event.version_id);
					if (source) await this.insert(manager, source, configuration);
				}
				await manager.query("INSERT INTO knowledge_chunk_event_receipts(event_id) VALUES($1)", [
					event.id,
				]);
			}
		});
	}

	async claim(): Promise<ChunkSet | null> {
		return this.db.transaction(async (manager) => {
			await manager.query(
				`UPDATE knowledge_chunk_sets SET status='FAILED',error_code='lease_expired',lease_token=NULL,lease_until=NULL,completed_at=clock_timestamp()
			 WHERE status='RUNNING' AND lease_until<=clock_timestamp() AND attempts>=$1`,
				[MAX_ATTEMPTS]
			);
			const [set]: ChunkSet[] = await manager.query(
				`SELECT * FROM knowledge_chunk_sets
			 WHERE ((status='PENDING' AND next_attempt_at<=clock_timestamp()) OR
			 (status='RUNNING' AND lease_until<=clock_timestamp())) AND attempts<$1
			 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
				[MAX_ATTEMPTS]
			);
			if (!set) return null;
			const [claim]: ChunkSet[] = await manager.query(
				`WITH changed AS (
			 UPDATE knowledge_chunk_sets SET status='RUNNING',attempts=attempts+1,lease_token=$2,
			 lease_until=clock_timestamp()+make_interval(secs=>$3),error_code=NULL WHERE id=$1 RETURNING *) SELECT * FROM changed`,
				[set.id, randomUUID(), LEASE_SECONDS]
			);
			return claim;
		});
	}

	async heartbeat(set: ChunkSet): Promise<boolean> {
		const rows: Array<{ id: string }> = await this.db.query(
			`WITH changed AS (UPDATE knowledge_chunk_sets
		 SET lease_until=clock_timestamp()+make_interval(secs=>$3) WHERE id=$1 AND status='RUNNING'
		 AND lease_token=$2 AND lease_until>clock_timestamp() RETURNING id) SELECT * FROM changed`,
			[set.id, set.lease_token, LEASE_SECONDS]
		);
		return rows.length === 1;
	}

	async finish(
		set: ChunkSet,
		result: ChunkOutput | { error: string; retryable: boolean }
	): Promise<boolean> {
		return this.db.transaction(async (manager) => {
			const source = await this.source(manager, set.document_id, set.document_version_id);
			const [current]: ChunkSet[] = await manager.query(
				`SELECT * FROM knowledge_chunk_sets WHERE id=$1 AND status='RUNNING'
			 AND lease_token=$2 AND lease_until>clock_timestamp() FOR UPDATE`,
				[set.id, set.lease_token]
			);
			if (!current) return false;
			let status: ChunkSetStatus;
			let error: string | null = null;
			let output: ChunkOutput | undefined;
			if (
				!source ||
				source.checksum !== set.checksum ||
				source.versionNumber !== set.source_version ||
				source.metadata.locale !== set.locale
			) {
				status = ChunkSetStatus.OBSOLETE;
				error = "source_changed_or_unavailable";
			} else if ("error" in result) {
				status =
					result.retryable && set.attempts < MAX_ATTEMPTS
						? ChunkSetStatus.PENDING
						: ChunkSetStatus.FAILED;
				error = result.error;
			} else {
				output = validateChunkOutput(result, current);
				status =
					output.quality.status === "PASSED" ? ChunkSetStatus.READY : ChunkSetStatus.NEEDS_REVIEW;
				error = status === ChunkSetStatus.NEEDS_REVIEW ? "extraction_needs_review" : null;
			}
			if (output && status === ChunkSetStatus.READY) {
				await manager.query(
					`INSERT INTO knowledge_chunks(chunk_set_id,document_version_id,source_version,locale,chunk_index,content,embedding_text,metadata,embedding)
				 SELECT $1,$2,$3,$4,c.chunk_index,c.content,c.embedding_text,
				 jsonb_build_object('headings',c.headings,'locations',c.locations,'token_count',c.token_count,'source_title',$6::text),c.embedding
				 FROM jsonb_to_recordset($5::jsonb) AS c(chunk_index integer,content text,embedding_text text,headings jsonb,locations jsonb,token_count integer,embedding double precision[])`,
					[
						set.id,
						set.document_version_id,
						set.source_version,
						set.locale,
						JSON.stringify(output.chunks),
						source?.metadata.sourceTitle,
					]
				);
			}
			await manager.query(
				`UPDATE knowledge_chunk_sets SET status=$2::varchar,error_code=$3,quality_report=$4::jsonb,
			 chunk_count=$5,lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+interval '30 seconds',
			 completed_at=CASE WHEN $2::varchar='PENDING' THEN NULL ELSE clock_timestamp() END WHERE id=$1`,
				[
					set.id,
					status,
					error,
					output ? JSON.stringify(output.quality) : null,
					output?.chunks.length ?? 0,
				]
			);
			if (status === ChunkSetStatus.READY) {
				await manager.query(
					`INSERT INTO knowledge_chunk_publications(document_id,chunk_set_id) VALUES($1,$2)
				 ON CONFLICT(document_id) DO UPDATE SET chunk_set_id=excluded.chunk_set_id`,
					[set.document_id, set.id]
				);
			}
			return true;
		});
	}

	async status(documentId: string, versionId: string): Promise<ChunkSetSummary[]> {
		const versions: Array<{ id: string }> = await this.db.query(
			"SELECT id FROM survival_document_versions WHERE document_id=$1 AND id=$2",
			[documentId, versionId]
		);
		if (!versions.length) throw new NotFoundException({ code: "KNOWLEDGE_SOURCE_NOT_FOUND" });
		return this.db.query(
			`SELECT id,document_version_id,source_version,locale,status,attempts,error_code,quality_report,
		 configuration,chunk_count,created_at,completed_at FROM knowledge_chunk_sets WHERE document_version_id=$1 ORDER BY created_at DESC,id`,
			[versionId]
		);
	}

	/** Internal consumption boundary for CTMS-068; excludes withdrawn and superseded sources immediately. */
	async readCurrent(documentId: string): Promise<StoredKnowledgeChunk[]> {
		return this.db.transaction(async (manager) => {
			await manager.query("SELECT id FROM survival_documents WHERE id=$1 FOR UPDATE", [documentId]);
			const [publication]: Array<{ document_version_id: string; chunk_set_id: string }> =
				await manager.query(
					`SELECT s.document_version_id,p.chunk_set_id
			 FROM knowledge_chunk_publications p JOIN knowledge_chunk_sets s ON s.id=p.chunk_set_id
			 WHERE p.document_id=$1 AND s.status='READY'`,
					[documentId]
				);
			if (
				!publication ||
				!(await this.source(manager, documentId, publication.document_version_id))
			)
				return [];
			return manager.query(
				"SELECT * FROM knowledge_chunks WHERE chunk_set_id=$1 ORDER BY chunk_index",
				[publication.chunk_set_id]
			);
		});
	}
}

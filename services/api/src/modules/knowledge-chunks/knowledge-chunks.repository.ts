import { createHash, randomUUID } from "node:crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager, QueryFailedError } from "typeorm";
import { isEligiblePublishedSource, sourceContentIssue } from "../survival-documents/source-policy";
import { type SourceVersion, VERSION_SELECT } from "../survival-documents/survival-documents.types";
import { validateChunkOutput } from "./knowledge-chunks.policy";
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

	private async currentSource(
		manager: EntityManager,
		documentId: string,
		versionId: string
	): Promise<SourceVersion | null> {
		// Publication, archive, deletion and commit serialize on the same document row.
		const [document]: Array<{ current_published_version_id: string | null }> = await manager.query(
			"SELECT current_published_version_id FROM survival_documents WHERE id=$1 FOR UPDATE",
			[documentId]
		);
		if (document?.current_published_version_id !== versionId) return null;
		const [version]: SourceVersion[] = await manager.query(
			`${VERSION_SELECT} WHERE document_id=$1 AND id=$2`,
			[documentId, versionId]
		);
		return version ?? null;
	}

	private async source(manager: EntityManager, documentId: string, versionId: string) {
		const version = await this.currentSource(manager, documentId, versionId);
		return version && isEligiblePublishedSource(version, versionId) ? version : null;
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
			}> = await manager.query(`
			 SELECT e.id,e.document_id,e.version_id,e.event_type FROM survival_document_outbox e WHERE NOT EXISTS
			 (SELECT 1 FROM knowledge_chunk_event_receipts r WHERE r.event_id=e.id)
			 ORDER BY e.created_at,e.id FOR UPDATE OF e SKIP LOCKED LIMIT 20`);
			// Other worker instances take document locks in the same order.
			events.sort((left, right) => left.document_id.localeCompare(right.document_id));
			for (const event of events) {
				if (event.event_type === "published_version_changed") {
					const source = await this.source(manager, event.document_id, event.version_id);
					if (source) await this.insert(manager, source, configuration);
				}
				await manager.query(
					"INSERT INTO knowledge_chunk_event_receipts(event_id) VALUES($1) ON CONFLICT DO NOTHING",
					[event.id]
				);
			}
		});
	}

	async reconcile(configuration: ChunkConfiguration) {
		const candidates: Array<{ id: string; version_id: string }> = await this.db.query(`
			SELECT d.id,v.id AS version_id
			FROM survival_documents d JOIN survival_document_versions v
			  ON v.id=d.current_published_version_id AND v.document_id=d.id
			WHERE v.status='PUBLISHED' AND NOT EXISTS (
			  SELECT 1 FROM knowledge_chunk_sets s WHERE s.document_version_id=v.id
			) ORDER BY d.id`);
		let queued = 0;
		const skipped: Array<{ versionId: string; reason: string }> = [];
		for (const candidate of candidates) {
			const outcome = await this.db.transaction(async (manager) => {
				const source = await this.currentSource(manager, candidate.id, candidate.version_id);
				if (!source) return "Phiên bản hiện hành đã thay đổi.";
				if (!isEligiblePublishedSource(source, candidate.version_id))
					return sourceContentIssue(source) ?? "Thông tin xuất bản hoặc tệp PDF không hợp lệ.";
				const existing: Array<{ id: string }> = await manager.query(
					"SELECT id FROM knowledge_chunk_sets WHERE document_version_id=$1 LIMIT 1",
					[source.id]
				);
				if (existing.length) return "Phiên bản đã có bộ đoạn trích.";
				await this.insert(manager, source, configuration);
				return null;
			});
			if (outcome === null) queued++;
			else skipped.push({ versionId: candidate.version_id, reason: outcome });
		}
		return { candidates: candidates.length, queued, skipped };
	}

	async cleanupHistory(
		retentionDays: number
	): Promise<{ deleted: number; retainedByDependency: number }> {
		const candidates: Array<{ id: string; document_id: string }> = await this.db.query(
			`
			SELECT old.id,old.document_id
			FROM survival_documents d
			JOIN knowledge_chunk_publications p ON p.document_id=d.id
			JOIN knowledge_chunk_sets replacement ON replacement.id=p.chunk_set_id
			JOIN survival_document_versions v ON v.document_id=d.id AND v.status='SUPERSEDED'
			JOIN knowledge_chunk_sets old ON old.document_version_id=v.id
			WHERE replacement.document_version_id=d.current_published_version_id
			  AND replacement.status='READY'
			  AND replacement.completed_at<=clock_timestamp()-make_interval(days=>$1)
			  AND old.status NOT IN ('PENDING','RUNNING')
			ORDER BY old.document_id,old.id`,
			[retentionDays]
		);
		let deleted = 0;
		let retainedByDependency = 0;
		for (const candidate of candidates) {
			try {
				deleted += await this.db.transaction(async (manager) => {
					// Same lock as publish, activation and offline source revalidation.
					const [document]: Array<{ current_published_version_id: string | null }> =
						await manager.query(
							"SELECT current_published_version_id FROM survival_documents WHERE id=$1 FOR UPDATE SKIP LOCKED",
							[candidate.document_id]
						);
					if (!document?.current_published_version_id) return 0;
					const replacement = await this.source(
						manager,
						candidate.document_id,
						document.current_published_version_id
					);
					if (!replacement) return 0;
					const removed: Array<{ id: string }> = await manager.query(
						`
						WITH removed AS (
							DELETE FROM knowledge_chunk_sets old USING survival_document_versions v
							WHERE old.id=$1 AND old.document_id=$2 AND old.document_version_id=v.id
							  AND v.status='SUPERSEDED' AND old.document_version_id<>$3
							  AND old.status NOT IN ('PENDING','RUNNING')
							  AND NOT EXISTS (
								SELECT 1 FROM knowledge_chunk_publications p WHERE p.chunk_set_id=old.id
							  )
							  AND EXISTS (
								SELECT 1 FROM knowledge_chunk_publications p
								JOIN knowledge_chunk_sets s ON s.id=p.chunk_set_id
								WHERE p.document_id=$2 AND s.document_version_id=$3
								  AND s.status='READY' AND s.checksum=$5 AND s.locale=$6 AND s.source_version=$7
								  AND s.completed_at<=clock_timestamp()-make_interval(days=>$4)
							  )
							RETURNING old.id
						) SELECT id FROM removed`,
						[
							candidate.id,
							candidate.document_id,
							replacement.id,
							retentionDays,
							replacement.checksum,
							replacement.metadata.locale,
							replacement.versionNumber,
						]
					);
					return removed.length;
				});
			} catch (error) {
				// A restrictive FK on the set or any cascading chunk rolls back this candidate.
				if (!(error instanceof QueryFailedError) || error.driverError.code !== "23503") throw error;
				retainedByDependency++;
			}
		}
		return { deleted, retainedByDependency };
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
			`SELECT s.id,s.document_version_id,s.source_version,s.locale,s.status,s.attempts,s.error_code,
			 s.quality_report,s.configuration,s.chunk_count,s.created_at,s.completed_at,
			 COALESCE(p.chunk_set_id=s.id AND d.current_published_version_id=s.document_version_id AND s.status='READY',false) AS active
			 FROM knowledge_chunk_sets s JOIN survival_documents d ON d.id=s.document_id
			 LEFT JOIN knowledge_chunk_publications p ON p.document_id=d.id
			 WHERE s.document_version_id=$1 ORDER BY s.created_at DESC,s.id`,
			[versionId]
		);
	}

	/** Internal consumption boundary for CTMS-068; excludes withdrawn and superseded sources immediately. */
	async readCurrent(documentId: string): Promise<StoredKnowledgeChunk[]> {
		return this.db.transaction(async (manager) => {
			await manager.query("SELECT id FROM survival_documents WHERE id=$1 FOR SHARE", [documentId]);
			const [publication]: Array<{
				document_version_id: string;
				chunk_set_id: string;
				source_version: number;
				checksum: string;
				locale: string;
				chunk_count: number;
			}> = await manager.query(
				`SELECT s.document_version_id,p.chunk_set_id,s.source_version,s.checksum,s.locale,s.chunk_count
			 FROM knowledge_chunk_publications p JOIN knowledge_chunk_sets s ON s.id=p.chunk_set_id
			 JOIN survival_documents d ON d.id=p.document_id
			 WHERE p.document_id=$1 AND s.status='READY' AND d.current_published_version_id=s.document_version_id`,
				[documentId]
			);
			if (!publication) return [];
			const [version]: SourceVersion[] = await manager.query(
				`${VERSION_SELECT} WHERE document_id=$1 AND id=$2`,
				[documentId, publication.document_version_id]
			);
			if (
				!isEligiblePublishedSource(version, publication.document_version_id) ||
				version.versionNumber !== publication.source_version ||
				version.checksum !== publication.checksum ||
				version.metadata.locale !== publication.locale
			)
				return [];
			const chunks: StoredKnowledgeChunk[] = await manager.query(
				"SELECT * FROM knowledge_chunks WHERE chunk_set_id=$1 ORDER BY chunk_index FOR SHARE",
				[publication.chunk_set_id]
			);
			return chunks.length === publication.chunk_count ? chunks : [];
		});
	}
}

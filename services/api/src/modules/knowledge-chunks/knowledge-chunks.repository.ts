import { createHash, randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager, QueryFailedError } from "typeorm";
import { isEligiblePublishedSource, sourceContentIssue } from "../survival-documents/source-policy";
import { type SourceVersion, VERSION_SELECT } from "../survival-documents/survival-documents.types";
import { isValidEmbedding, validateChunkOutput } from "./knowledge-chunks.policy";
import {
	type ChunkConfiguration,
	type ChunkFailure,
	type ChunkOutput,
	type ChunkSet,
	ChunkSetStatus,
	type ChunkSetSummary,
	LEASE_SECONDS,
	MAX_ATTEMPTS,
	MAX_RECOVERY_ROUNDS,
	QUEUE_BATCH_SIZE,
	RECOVERY_DELAY_SECONDS,
	RETRY_BASE_SECONDS,
	type StoredKnowledgeChunk,
} from "./knowledge-chunks.types";

function configHash(configuration: ChunkConfiguration): string {
	return createHash("sha256").update(JSON.stringify(configuration)).digest("hex");
}

const attemptDelay = `make_interval(secs=>${RETRY_BASE_SECONDS} * power(2, greatest(0,s.attempts-1)))`;
const recoveryDelay = `make_interval(secs=>CASE WHEN s.recovery_round=0
	THEN ${RECOVERY_DELAY_SECONDS[0]} ELSE ${RECOVERY_DELAY_SECONDS[1]} END)`;
const dueRecoveries = `
	SELECT s.id FROM knowledge_chunk_sets s
	JOIN survival_documents d ON d.id=s.document_id AND d.current_published_version_id=s.document_version_id
	WHERE s.status='FAILED' AND s.retryable_failure AND s.recovery_round<${MAX_RECOVERY_ROUNDS}
	  AND s.config_hash=$1 AND s.next_attempt_at<=clock_timestamp()
	ORDER BY s.next_attempt_at,s.id`;
const embeddingInputHash = "encode(sha256(convert_to(embedding_text,'UTF8')),'hex')";

function validStoredEmbedding(column: string, dimensions: string): string {
	return `array_ndims(${column})=1 AND cardinality(${column})=${dimensions}
		AND NOT EXISTS (SELECT 1 FROM unnest(${column}) AS v(value)
			WHERE value IS NULL OR value IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8))
		AND EXISTS (SELECT 1 FROM unnest(${column}) AS v(value) WHERE value<>0)`;
}

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
	): Promise<void> {
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
				configHash(configuration),
			]
		);
	}

	async consumeEvents(configuration: ChunkConfiguration): Promise<void> {
		await this.db.transaction(async (manager) => {
			const events: Array<{
				id: string;
				document_id: string;
				version_id: string;
				previous_version_id: string | null;
				event_type: string;
			}> = await manager.query(`
			 SELECT e.id,e.document_id,e.version_id,e.previous_version_id,e.event_type FROM survival_document_outbox e WHERE NOT EXISTS
			 (SELECT 1 FROM knowledge_chunk_event_receipts r WHERE r.event_id=e.id)
			 ORDER BY e.created_at,e.id LIMIT ${QUEUE_BATCH_SIZE} FOR UPDATE OF e SKIP LOCKED`);
			// Other worker instances take document locks in the same order.
			events.sort((left, right) => left.document_id.localeCompare(right.document_id));
			for (const event of events) {
				if (event.previous_version_id) {
					await manager.query("SELECT id FROM survival_documents WHERE id=$1 FOR UPDATE", [
						event.document_id,
					]);
					await manager.query(
						`UPDATE knowledge_chunk_sets SET status='OBSOLETE',error_code='source_changed_or_unavailable',
						 lease_token=NULL,lease_until=NULL,retryable_failure=false,completed_at=clock_timestamp()
						 WHERE document_version_id=$1 AND status IN ('PENDING','RUNNING')`,
						[event.previous_version_id]
					);
				}
				// Historical approval events can still carry a publication; current policy decides eligibility.
				if (["published_version_changed", "processing_approved"].includes(event.event_type)) {
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

	async reconcile(configuration: ChunkConfiguration, after: string | null = null, limit?: number) {
		const hash = configHash(configuration);
		const candidates: Array<{ id: string; version_id: string }> = await this.db.query(
			`
			SELECT d.id,v.id AS version_id
			FROM survival_documents d JOIN survival_document_versions v
			  ON v.id=d.current_published_version_id AND v.document_id=d.id
			WHERE v.status='PUBLISHED' AND ($2::uuid IS NULL OR d.id>$2) AND NOT EXISTS (
			  SELECT 1 FROM knowledge_chunk_sets s WHERE s.document_version_id=v.id AND s.config_hash=$1
			) ORDER BY d.id LIMIT $3`,
			[hash, after, limit ?? null]
		);
		let queued = 0;
		const skipped: Array<{ versionId: string; reason: string }> = [];
		for (const candidate of candidates) {
			const outcome = await this.db.transaction(async (manager) => {
				const source = await this.currentSource(manager, candidate.id, candidate.version_id);
				if (!source) return "Phiên bản hiện hành đã thay đổi.";
				if (!isEligiblePublishedSource(source, candidate.version_id))
					return sourceContentIssue(source) ?? "Thông tin xuất bản hoặc tệp PDF không hợp lệ.";
				const existing: Array<{ id: string }> = await manager.query(
					"SELECT id FROM knowledge_chunk_sets WHERE document_version_id=$1 AND config_hash=$2",
					[source.id, hash]
				);
				if (existing.length) return "Phiên bản đã có bộ đoạn trích.";
				await this.insert(manager, source, configuration);
				return null;
			});
			if (outcome === null) queued++;
			else skipped.push({ versionId: candidate.version_id, reason: outcome });
		}
		return {
			candidates: candidates.length,
			queued,
			skipped,
			lastDocumentId: candidates.at(-1)?.id ?? null,
		};
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
					if (removed.length) {
						await manager.query(
							`DELETE FROM knowledge_embeddings e WHERE e.document_id=$1 AND NOT EXISTS (
								SELECT 1 FROM knowledge_chunks c WHERE c.embedding_id=e.id
							)`,
							[candidate.document_id]
						);
					}
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

	async hasRecoverableFailures(configuration: ChunkConfiguration): Promise<boolean> {
		const due: Array<{ id: string }> = await this.db.query(`${dueRecoveries} LIMIT 1`, [
			configHash(configuration),
		]);
		return due.length > 0;
	}

	async recoverFailed(configuration: ChunkConfiguration): Promise<void> {
		await this.db.query(
			`WITH due AS (${dueRecoveries} LIMIT ${QUEUE_BATCH_SIZE} FOR UPDATE OF s SKIP LOCKED)
			 UPDATE knowledge_chunk_sets s SET status='PENDING',attempts=0,
			  recovery_round=s.recovery_round+1,next_attempt_at=clock_timestamp(),completed_at=NULL
			 FROM due WHERE s.id=due.id`,
			[configHash(configuration)]
		);
	}

	async claim(configuration: ChunkConfiguration): Promise<ChunkSet | null> {
		await this.db.query(
			`WITH expired AS (
			   SELECT id FROM knowledge_chunk_sets WHERE status='RUNNING' AND lease_until<=clock_timestamp()
			   ORDER BY lease_until,id LIMIT ${QUEUE_BATCH_SIZE} FOR UPDATE SKIP LOCKED
			 )
			 UPDATE knowledge_chunk_sets s SET status=CASE WHEN s.attempts<$1 THEN 'PENDING' ELSE 'FAILED' END,
			  error_code='lease_expired',retryable_failure=true,lease_token=NULL,lease_until=NULL,
			  next_attempt_at=clock_timestamp()+CASE WHEN s.attempts<$1 THEN ${attemptDelay} ELSE ${recoveryDelay} END,
			  completed_at=CASE WHEN s.attempts>=$1 THEN clock_timestamp() END
			 FROM expired WHERE s.id=expired.id`,
			[MAX_ATTEMPTS]
		);
		const [claim]: ChunkSet[] = await this.db.query(
			`WITH candidate AS (
			   SELECT s.id FROM knowledge_chunk_sets s
			   JOIN survival_documents d ON d.id=s.document_id AND d.current_published_version_id=s.document_version_id
			   WHERE s.status='PENDING' AND s.next_attempt_at<=clock_timestamp() AND s.attempts<$1 AND s.config_hash=$2
			   ORDER BY s.next_attempt_at,s.created_at,s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED
			 ), changed AS (
			   UPDATE knowledge_chunk_sets s SET status='RUNNING',attempts=s.attempts+1,lease_token=$3,
			    lease_until=clock_timestamp()+make_interval(secs=>$4),error_code=NULL,retryable_failure=false
			   FROM candidate WHERE s.id=candidate.id RETURNING s.*
			 ) SELECT * FROM changed`,
			[MAX_ATTEMPTS, configHash(configuration), randomUUID(), LEASE_SECONDS]
		);
		return claim ?? null;
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

	async reusableEmbeddings(set: ChunkSet, inputs: string[]): Promise<Map<string, number[]>> {
		if (!inputs.length) return new Map();
		const dimensions = set.configuration.embedding_dimensions;
		const rows: Array<{ embedding_text: string; embedding: unknown }> = await this.db.query(
			`WITH requested AS (
				SELECT embedding_text,${embeddingInputHash} AS input_hash
				FROM unnest($1::text[]) AS requested(embedding_text)
			), candidates AS (
				SELECT r.embedding_text,e.embedding,0 AS priority,e.id
				FROM requested r JOIN knowledge_embeddings e
				  ON e.document_id=$2 AND e.config_hash=$3 AND e.input_hash=r.input_hash AND e.embedding_text=r.embedding_text
				UNION ALL
				SELECT r.embedding_text,c.embedding,1,c.id
				FROM knowledge_chunk_sets s JOIN knowledge_chunks c ON c.chunk_set_id=s.id
				JOIN requested r ON r.embedding_text=c.embedding_text
				WHERE s.document_id=$2 AND s.config_hash=$3 AND s.configuration=$4::jsonb
				  AND s.status='READY' AND s.document_version_id<>$5 AND c.embedding IS NOT NULL
			)
			SELECT DISTINCT ON (embedding_text) embedding_text,embedding FROM candidates
			WHERE ${validStoredEmbedding("embedding", "$6")}
			ORDER BY embedding_text,priority,id`,
			[
				inputs,
				set.document_id,
				set.config_hash,
				JSON.stringify(set.configuration),
				set.document_version_id,
				dimensions,
			]
		);
		const vectors = new Map<string, number[]>();
		for (const row of rows) {
			if (isValidEmbedding(row.embedding, dimensions))
				vectors.set(row.embedding_text, row.embedding);
		}
		return vectors;
	}

	async finish(set: ChunkSet, result: ChunkOutput | ChunkFailure): Promise<boolean> {
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
			let quality: ChunkSetSummary["quality_report"] = null;
			let retryable = false;
			if (
				!source ||
				source.checksum !== set.checksum ||
				source.versionNumber !== set.source_version ||
				source.metadata.locale !== set.locale
			) {
				status = ChunkSetStatus.OBSOLETE;
				error = "source_changed_or_unavailable";
			} else if ("error" in result && result.quality) {
				status = ChunkSetStatus.NEEDS_REVIEW;
				error = "extraction_needs_review";
				quality = result.quality;
			} else if ("error" in result) {
				retryable = result.retryable;
				status =
					retryable && current.attempts < MAX_ATTEMPTS
						? ChunkSetStatus.PENDING
						: ChunkSetStatus.FAILED;
				error = result.error;
			} else {
				output = validateChunkOutput(result, current);
				quality = output.quality;
				status =
					output.quality.status === "PASSED" ? ChunkSetStatus.READY : ChunkSetStatus.NEEDS_REVIEW;
				error = status === ChunkSetStatus.NEEDS_REVIEW ? "extraction_needs_review" : null;
			}
			if (output && status === ChunkSetStatus.READY) {
				const embeddings = output.chunks.map(({ chunk_index, embedding_text, embedding }) => ({
					chunk_index,
					embedding_text,
					embedding,
				}));
				const chunks = output.chunks.map(({ embedding, ...chunk }) => chunk);
				await manager.query(
					`INSERT INTO knowledge_embeddings AS e(document_id,config_hash,input_hash,embedding_text,embedding)
					 SELECT DISTINCT ON (embedding_text) $1,$2,${embeddingInputHash},embedding_text,embedding
					 FROM jsonb_to_recordset($3::jsonb) AS c(chunk_index integer,embedding_text text,embedding float8[])
					 ORDER BY embedding_text,chunk_index
					 ON CONFLICT(document_id,config_hash,input_hash) DO UPDATE SET embedding=excluded.embedding
					 WHERE e.embedding_text=excluded.embedding_text AND NOT (${validStoredEmbedding("e.embedding", "$4")})`,
					[
						set.document_id,
						current.config_hash,
						JSON.stringify(embeddings),
						current.configuration.embedding_dimensions,
					]
				);
				const inserted: Array<{ id: string }> = await manager.query(
					`WITH chunks AS (
						SELECT c.*,${embeddingInputHash} AS input_hash
						FROM jsonb_to_recordset($5::jsonb) AS c(chunk_index integer,content text,embedding_text text,headings jsonb,locations jsonb,token_count integer)
					 )
					 INSERT INTO knowledge_chunks(chunk_set_id,document_version_id,source_version,locale,chunk_index,content,embedding_text,metadata,embedding_id)
					 SELECT $1,$2,$3,$4,c.chunk_index,c.content,c.embedding_text,
					 jsonb_build_object('headings',c.headings,'locations',c.locations,'token_count',c.token_count,'source_title',$6::text),e.id
					 FROM chunks c JOIN knowledge_embeddings e
					   ON e.document_id=$7 AND e.config_hash=$8 AND e.input_hash=c.input_hash AND e.embedding_text=c.embedding_text
					 RETURNING id`,
					[
						set.id,
						set.document_version_id,
						set.source_version,
						set.locale,
						JSON.stringify(chunks),
						source?.metadata.sourceTitle,
						set.document_id,
						current.config_hash,
					]
				);
				if (inserted.length !== output.chunks.length)
					throw new Error("Incomplete knowledge embedding mappings");
			}
			await manager.query(
				`UPDATE knowledge_chunk_sets s SET status=$2::varchar,error_code=$3,quality_report=$4::jsonb,
			 chunk_count=$5,retryable_failure=$6,lease_token=NULL,lease_until=NULL,
			 next_attempt_at=clock_timestamp()+CASE
			  WHEN $2::varchar='PENDING' THEN ${attemptDelay}
			  WHEN $2::varchar='FAILED' AND $6 THEN ${recoveryDelay}
			  ELSE interval '0 seconds' END,
			 completed_at=CASE WHEN $2::varchar='PENDING' THEN NULL ELSE clock_timestamp() END WHERE id=$1`,
				[
					set.id,
					status,
					error,
					quality ? JSON.stringify(quality) : null,
					output?.chunks.length ?? 0,
					retryable,
				]
			);
			if (status === ChunkSetStatus.READY) {
				await manager.query(
					`INSERT INTO knowledge_chunk_publications(document_id,chunk_set_id)
				 SELECT candidate.document_id,candidate.id FROM knowledge_chunk_sets candidate
				 WHERE candidate.id=$1 AND NOT EXISTS (
				   SELECT 1 FROM knowledge_chunk_publications p JOIN knowledge_chunk_sets active ON active.id=p.chunk_set_id
				   WHERE p.document_id=candidate.document_id AND active.document_version_id=candidate.document_version_id
				    AND (active.created_at,active.id)>(candidate.created_at,candidate.id)
				 )
				 ON CONFLICT(document_id) DO UPDATE SET chunk_set_id=excluded.chunk_set_id`,
					[set.id]
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
			 (s.status='FAILED' AND s.retryable_failure AND s.recovery_round<${MAX_RECOVERY_ROUNDS}) AS automatic_recovery_pending,
			 s.quality_report,s.configuration,s.chunk_count,s.created_at,s.completed_at,
			 COALESCE(p.chunk_set_id=s.id AND d.current_published_version_id=s.document_version_id AND s.status='READY',false) AS active
			 FROM knowledge_chunk_sets s JOIN survival_documents d ON d.id=s.document_id
			 LEFT JOIN knowledge_chunk_publications p ON p.document_id=d.id
			 WHERE s.document_version_id=$1 ORDER BY s.created_at DESC,s.id DESC`,
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
				`SELECT c.*,COALESCE(e.embedding,c.embedding) AS embedding
				 FROM knowledge_chunks c LEFT JOIN knowledge_embeddings e ON e.id=c.embedding_id
				 WHERE c.chunk_set_id=$1 ORDER BY c.chunk_index FOR SHARE OF c`,
				[publication.chunk_set_id]
			);
			return chunks.length === publication.chunk_count ? chunks : [];
		});
	}
}

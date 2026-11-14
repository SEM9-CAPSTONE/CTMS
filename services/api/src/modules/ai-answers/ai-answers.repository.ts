import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { AI_REQUEST_LEASE_MS, AI_REQUEST_LIMIT_MS, type StoredAnswer } from "./ai-answers.types";

@Injectable()
export class AiAnswersRepository {
	constructor(private readonly db: DataSource) {}

	async findByRequest(userId: string, requestId: string): Promise<StoredAnswer | undefined> {
		const [row]: StoredAnswer[] = await this.db.query(
			"SELECT * FROM ai_answers WHERE user_id=$1 AND request_id=$2 AND expires_at>clock_timestamp()",
			[userId, requestId]
		);
		return row;
	}

	async findForOwner(userId: string, answerId: string): Promise<StoredAnswer | undefined> {
		const [row]: StoredAnswer[] = await this.db.query(
			"SELECT * FROM ai_answers WHERE user_id=$1 AND id=$2 AND expires_at>clock_timestamp()",
			[userId, answerId]
		);
		return row;
	}

	async acquire(userId: string): Promise<string | null> {
		const leaseId = randomUUID();
		const rows: Array<{ lease_id: string }> = await this.db.query(
			`INSERT INTO ai_answer_request_limits(user_id,next_request_at,lease_id,lease_until)
			 VALUES($1,clock_timestamp()+$3::int*interval '1 ms',$2,clock_timestamp()+$4::int*interval '1 ms')
			 ON CONFLICT(user_id) DO UPDATE SET next_request_at=excluded.next_request_at,
			 lease_id=excluded.lease_id,lease_until=excluded.lease_until
			 WHERE ai_answer_request_limits.next_request_at<=clock_timestamp()
			   AND ai_answer_request_limits.lease_until<=clock_timestamp()
			 RETURNING lease_id`,
			[userId, leaseId, AI_REQUEST_LIMIT_MS, AI_REQUEST_LEASE_MS]
		);
		return rows.length ? leaseId : null;
	}

	async release(userId: string, leaseId: string): Promise<void> {
		await this.db.query(
			`UPDATE ai_answer_request_limits SET lease_until=clock_timestamp(),lease_id=NULL
			 WHERE user_id=$1 AND lease_id=$2`,
			[userId, leaseId]
		);
	}

	async save(
		manager: EntityManager,
		userId: string,
		leaseId: string,
		requestId: string,
		row: Omit<StoredAnswer, "id">,
		generation: { provider: string; model: string; promptVersion: string },
		retrievalConfigVersion: string
	): Promise<StoredAnswer> {
		const [lease]: Array<{ lease_id: string }> = await manager.query(
			`SELECT lease_id FROM ai_answer_request_limits
			 WHERE user_id=$1 AND lease_id=$2 AND lease_until>clock_timestamp() FOR UPDATE`,
			[userId, leaseId]
		);
		if (!lease) throw new Error("AI answer request lease expired");
		// Bound cleanup work and skip rows another API instance is already purging.
		await manager.query(`
			DELETE FROM ai_answers WHERE id IN (
				SELECT id FROM ai_answers WHERE expires_at<=clock_timestamp()
				ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
			)`);
		await manager.query(
			"DELETE FROM ai_answers WHERE user_id=$1 AND request_id=$2 AND expires_at<=clock_timestamp()",
			[userId, requestId]
		);
		const [saved]: StoredAnswer[] = await manager.query(
			`INSERT INTO ai_answers(user_id,request_id,request_hash,locale,answer,retrieved_evidence,
			 cited_chunk_ids,generation,retrieval_config_version)
			 VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::uuid[],$8::jsonb,$9) RETURNING *`,
			[
				userId,
				requestId,
				row.request_hash,
				row.locale,
				row.answer,
				JSON.stringify(row.retrieved_evidence),
				row.cited_chunk_ids,
				JSON.stringify(generation),
				retrievalConfigVersion,
			]
		);
		return saved;
	}
}

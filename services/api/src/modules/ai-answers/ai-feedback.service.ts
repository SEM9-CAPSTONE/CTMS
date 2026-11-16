import { createHash } from "node:crypto";
import {
	ConflictException,
	HttpException,
	Injectable,
	Logger,
	NotFoundException,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { aiUnavailable, ensureCamper } from "./ai-answers.policy";
// biome-ignore lint/style/useImportType: Nest injection
import { AiAnswersRepository } from "./ai-answers.repository";
import { type FeedbackInput, type FeedbackRating, feedbackInput } from "./ai-feedback.policy";

type FeedbackRow = {
	id: string;
	rating: FeedbackRating | null;
	reported_unsafe: boolean;
};

type FeedbackAck = {
	feedbackId: string;
	revision: number;
	rating: FeedbackRating | null;
	reportedUnsafe: boolean;
};

function conflict(): never {
	throw new ConflictException({ code: "AI_FEEDBACK_CONFLICT" });
}

@Injectable()
export class AiFeedbackService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(AiFeedbackService.name);
	private cleanup?: NodeJS.Timeout;

	constructor(
		private readonly db: DataSource,
		private readonly answers: AiAnswersRepository
	) {}

	onModuleInit() {
		this.cleanup = setInterval(() => {
			void this.purgeExpired().catch(() => this.logger.warn("AI_FEEDBACK_PURGE_FAILED"));
		}, 60 * 60_000).unref();
	}

	onModuleDestroy() {
		clearInterval(this.cleanup);
	}

	async purgeExpired() {
		await this.answers.purgeExpired(this.db.manager, 1000);
		await this.db.query(`
			DELETE FROM ai_answer_feedback WHERE id IN (
				SELECT id FROM ai_answer_feedback WHERE expires_at <= clock_timestamp()
				ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
			)
		`);
	}

	async submit(actor: AuthenticatedUser, body: unknown): Promise<FeedbackAck> {
		ensureCamper(actor);
		const input = feedbackInput(body);
		const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
		try {
			return await this.db.transaction((manager) =>
				this.persist(manager, actor.userId, input, hash)
			);
		} catch (error) {
			if (error instanceof HttpException) throw error;
			this.logger.warn("AI_FEEDBACK_WRITE_FAILED");
			throw aiUnavailable("AI_FEEDBACK_UNAVAILABLE");
		}
	}

	private async persist(
		manager: EntityManager,
		userId: string,
		input: FeedbackInput,
		hash: string
	): Promise<FeedbackAck> {
		// Serialize revisions and operation identity checks across API instances.
		await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 260))", [userId]);
		const online = input.inferenceMode === "ONLINE" ? input : null;
		const local = input.inferenceMode === "LOCAL" ? input : null;
		let onlineExpiry: Date | null = null;
		if (online) {
			const [answer]: Array<{ expires_at: Date }> = await manager.query(
				`SELECT expires_at FROM ai_answers WHERE user_id=$1 AND id=$2
				 AND expires_at>clock_timestamp() FOR KEY SHARE`,
				[userId, online.answerId]
			);
			if (!answer) throw new NotFoundException({ code: "AI_ANSWER_NOT_FOUND" });
			onlineExpiry = answer.expires_at;
		}
		const [replay]: Array<{ request_hash: string; ack: FeedbackAck }> = await manager.query(
			`SELECT m.request_hash, m.ack FROM ai_answer_feedback_mutations m
			 JOIN ai_answer_feedback f ON f.id=m.feedback_id
			 WHERE m.user_id=$1 AND m.mutation_id=$2 AND f.expires_at>clock_timestamp()
			 FOR UPDATE OF f`,
			[userId, input.clientMutationId]
		);
		if (replay) {
			if (replay.request_hash !== hash) conflict();
			return replay.ack;
		}

		const [current]: Array<FeedbackRow & { evidence_matches: boolean; expired: boolean }> =
			await manager.query(
				`SELECT id, rating, reported_unsafe,
				 local_evidence IS NOT DISTINCT FROM $5::jsonb AS evidence_matches,
				 expires_at<=clock_timestamp() AS expired
				 FROM ai_answer_feedback WHERE user_id=$1 AND
				 (answer_id=$2 OR (installation_id=$3 AND local_answer_id=$4)) FOR UPDATE`,
				[
					userId,
					online?.answerId,
					local?.installationId,
					local?.localAnswerId,
					local ? JSON.stringify(local.evidence) : null,
				]
			);
		if (current && (current.expired || !current.evidence_matches)) conflict();

		const [stream]: Array<{ feedback_id: string; revision: number; already_used: boolean }> =
			await manager.query(
				`SELECT feedback_id, max(revision)::int AS revision, bool_or(revision=$3) AS already_used
				 FROM ai_answer_feedback_mutations WHERE user_id=$1 AND client_feedback_id=$2
				 GROUP BY feedback_id`,
				[userId, input.clientFeedbackId, input.revision]
			);
		if (stream && (stream.feedback_id !== current?.id || stream.already_used)) conflict();
		const latest = Math.max(input.revision, stream?.revision ?? 0);
		const newRating = input.revision === latest ? input.rating : null;
		let result = current;
		if (current) {
			[result] = await manager.query(
				`WITH updated AS (
				 UPDATE ai_answer_feedback SET rating=COALESCE($2,rating),
				 reason=CASE WHEN NOT reported_unsafe AND $3 THEN $4
				             WHEN NOT reported_unsafe AND $6 THEN COALESCE($4,reason) ELSE reason END,
				 reported_at=CASE WHEN NOT reported_unsafe AND $3 THEN $5 ELSE reported_at END,
				 review_status=CASE WHEN NOT reported_unsafe AND $3 THEN 'pending' ELSE review_status END,
				 reported_unsafe=reported_unsafe OR $3 WHERE id=$1 RETURNING id,rating,reported_unsafe
				) SELECT * FROM updated`,
				[
					current.id,
					newRating,
					input.reportedUnsafe,
					input.reason,
					input.reportedAt,
					input.revision === latest,
				]
			);
		} else {
			[result] = await manager.query(
				`INSERT INTO ai_answer_feedback(user_id,answer_id,installation_id,local_answer_id,local_evidence,
				 rating,reported_unsafe,reason,reported_at,review_status,expires_at)
				 VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,CASE WHEN $7 THEN $9::timestamptz END,
				        CASE WHEN $7 THEN 'pending' END,COALESCE($10,clock_timestamp()+interval '30 days'))
				 RETURNING id,rating,reported_unsafe`,
				[
					userId,
					online?.answerId,
					local?.installationId,
					local?.localAnswerId,
					local ? JSON.stringify(local.evidence) : null,
					input.rating,
					input.reportedUnsafe,
					input.reason,
					input.reportedAt,
					onlineExpiry,
				]
			);
		}
		const ack: FeedbackAck = {
			feedbackId: result.id,
			revision: latest,
			rating: result.rating,
			reportedUnsafe: result.reported_unsafe,
		};
		await manager.query(
			`INSERT INTO ai_answer_feedback_mutations
			 (user_id,mutation_id,feedback_id,client_feedback_id,revision,request_hash,client_created_at,ack)
			 VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
			[
				userId,
				input.clientMutationId,
				result.id,
				input.clientFeedbackId,
				input.revision,
				hash,
				input.createdAt,
				JSON.stringify(ack),
			]
		);
		return ack;
	}
}

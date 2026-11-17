import type { EntityManager } from "typeorm";
import type { FeedbackInput } from "../ai-answers/ai-feedback.policy";
import { CasePriority, type Signal, type Snapshot } from "./ai-investigation.types";

export function effectiveChange(previous: Signal | undefined, accepted: Signal): boolean {
	return (
		!previous ||
		previous.rating !== accepted.rating ||
		previous.reported_unsafe !== accepted.reported_unsafe ||
		previous.reason !== accepted.reason
	);
}

export function investigationPriority(signal: Signal): CasePriority {
	if (signal.reported_unsafe) return CasePriority.UNSAFE;
	return signal.rating === "NOT_USEFUL" ? CasePriority.NOT_USEFUL : CasePriority.USEFUL;
}

async function capture(
	manager: EntityManager,
	userId: string,
	input: FeedbackInput
): Promise<Snapshot> {
	if (input.inferenceMode === "LOCAL") {
		return { mode: "LOCAL", local: input.evidence, installationId: input.installationId };
	}
	const [online]: Array<Extract<Snapshot, { mode: "ONLINE" }>["online"]> = await manager.query(
		`SELECT locale,question,answer,generation,retrieval_config_version,retrieved_evidence,cited_chunk_ids
		 FROM ai_answers WHERE id=$1 AND user_id=$2`,
		[input.answerId, userId]
	);
	if (!online) throw new Error("Investigation evidence disappeared during feedback acceptance");
	return { mode: "ONLINE", online };
}

/** Called inside the feedback and receipt transaction, after CTMS-072 has accepted the signal. */
export async function recordInvestigationIntake(
	manager: EntityManager,
	userId: string,
	input: FeedbackInput,
	previous: Signal | undefined,
	accepted: Signal
) {
	if (!effectiveChange(previous, accepted)) return;
	const priority = investigationPriority(accepted);
	const [job]: Array<{ id: string; created_at: Date }> = await manager.query(
		`INSERT INTO ai_investigation_jobs(feedback_id,mutation_id,rating,priority)
		 VALUES($1,$2,$3,$4) RETURNING id,created_at`,
		[accepted.id, input.clientMutationId, accepted.rating, priority]
	);
	if (priority === CasePriority.USEFUL) return;
	const snapshot: Snapshot = {
		...(await capture(manager, userId, input)),
		intake: {
			receivedAt: job.created_at.toISOString(),
			clientActionAt: input.createdAt,
			rating: accepted.rating,
			reportedUnsafe: accepted.reported_unsafe,
			reason: accepted.reason,
		},
	};
	const unsafe = priority === CasePriority.UNSAFE;
	await manager.query(
		`INSERT INTO ai_investigation_cases AS c
		 (feedback_id,answer_id,mode,latest_job_id,snapshot,reported_at,review_status,report_reason)
		 VALUES($1,$2,$3,$4,$5::jsonb,$6,CASE WHEN $6::timestamptz IS NOT NULL THEN 'pending' END,$7)
		 ON CONFLICT(feedback_id) DO UPDATE SET
		 latest_job_id=excluded.latest_job_id, snapshot=coalesce(c.snapshot,excluded.snapshot),
		 evidence_removed_at=NULL, report=NULL, report_reason=excluded.report_reason,
		 reported_at=coalesce(c.reported_at,excluded.reported_at),
		 review_status=coalesce(c.review_status,excluded.review_status),
		 technical_status=CASE WHEN c.closed_at IS NOT NULL AND c.review_status IS NULL AND excluded.review_status IS NOT NULL
		                       THEN 'OPEN' ELSE c.technical_status END,
		 closed_at=CASE WHEN c.review_status IS NULL AND excluded.review_status IS NOT NULL THEN NULL ELSE c.closed_at END,
		 resolution_note=CASE WHEN c.review_status IS NULL AND excluded.review_status IS NOT NULL THEN NULL ELSE c.resolution_note END,
		 version=c.version+1
		 WHERE c.snapshot IS NOT NULL OR (c.review_status IS NULL AND excluded.review_status IS NOT NULL)`,
		[
			accepted.id,
			input.inferenceMode === "ONLINE" ? input.answerId : input.localAnswerId,
			input.inferenceMode,
			job.id,
			JSON.stringify(snapshot),
			unsafe ? accepted.reported_at : null,
			accepted.reason,
		]
	);
}

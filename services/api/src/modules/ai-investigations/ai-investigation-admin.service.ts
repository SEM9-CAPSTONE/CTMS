import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import {
	AdminAction,
	ensureInvestigationAdmin,
	nextReviewState,
	parseAdminAction,
} from "./ai-investigation-admin.policy";
import {
	AiInvestigationEvidence,
	snapshotContent,
	unmatchedCitation,
} from "./ai-investigation-evidence";
import type { ListAiInvestigationsQuery } from "./ai-investigation.controller";
import type {
	Classification,
	InvestigationReport,
	Job,
	Processing,
	Review,
	Snapshot,
	Technical,
} from "./ai-investigation.types";

const AUDIT_TARGET = "AI_INVESTIGATION";
const summarySelect = `c.id, c.mode, c.created_at AS "createdAt", c.reported_at AS "reportedAt",
	c.review_status AS "reviewStatus", c.technical_status AS "technicalStatus", c.closed_at AS "closedAt",
	j.status AS "processingStatus", j.rating`;
const retainedTurn = `(CASE c.mode WHEN 'LOCAL' THEN c.snapshot->'local' ELSE c.snapshot->'online' END)`;
const questionPreview = `left(nullif(btrim(regexp_replace(${retainedTurn}->>'question',
	'[[:space:]]+', ' ', 'g')), ''), 180) AS "questionPreview"`;
const unsafeCase = "c.review_status IS NOT NULL";
const notUsefulCase = "c.review_status IS NULL AND j.rating='NOT_USEFUL'";

type Summary = {
	id: string;
	mode: Snapshot["mode"];
	createdAt: Date;
	reportedAt: Date | null;
	reviewStatus: Review | null;
	technicalStatus: Technical;
	closedAt: Date | null;
	processingStatus: Processing;
	rating: Job["rating"];
};

type CaseDetail = Summary & {
	feedbackId: string;
	answerId: string;
	snapshot: Snapshot | null;
	report: InvestigationReport | null;
	reason: string | null;
	evidenceRemovedAt: Date | null;
	version: number;
	reviewerId: string | null;
	reviewerName: string | null;
	reviewedAt: Date | null;
	resolutionNote: string | null;
};

type Group = { id: string; issueIndex: number; classification: Classification; caseCount: number };
type History = {
	version: number;
	reference: string | null;
	verification: string | null;
	resolutionNote: string | null;
	actorName: string | null;
	action: string;
	at: Date;
	technicalStatus: Technical;
	reviewStatus: Review | null;
};

function notFound(): never {
	throw new NotFoundException({ code: "AI_INVESTIGATION_NOT_FOUND" });
}

@Injectable()
export class AiInvestigationAdminService {
	constructor(
		@Inject(DataSource) private readonly db: DataSource,
		@Inject(AiInvestigationEvidence) private readonly evidence: AiInvestigationEvidence
	) {}

	async list(actor: AuthenticatedUser, query: ListAiInvestigationsQuery) {
		ensureInvestigationAdmin(actor);
		const page = query.page ?? 1;
		const limit = query.limit ?? 20;
		const filters = [
			query.scope ?? "ALL",
			query.reviewStatus ?? null,
			query.groupId ?? null,
			query.q?.trim() || null,
		];
		const from =
			"FROM ai_investigation_cases c JOIN ai_investigation_jobs j ON j.id=c.latest_job_id";
		const matches = `($1='ALL' OR ($1='UNSAFE' AND ${unsafeCase})
		 OR ($1='NOT_USEFUL' AND ${notUsefulCase}))
		 AND ($2::varchar IS NULL OR c.review_status=$2)
		 AND ($3::uuid IS NULL OR ((c.report IS NOT NULL OR c.evidence_removed_at IS NOT NULL) AND EXISTS (
			SELECT 1 FROM ai_investigation_members WHERE case_id=c.id AND group_id=$3)))
		 AND ($4::text IS NULL OR strpos(lower(${retainedTurn}->>'question'), lower($4)) > 0
		 OR strpos(lower(${retainedTurn}->>'answer'), lower($4)) > 0)`;
		return this.db.transaction("REPEATABLE READ", async (manager) => {
			const [group]: Array<{ classification: Classification }> = query.groupId
				? await manager.query("SELECT classification FROM ai_investigation_groups WHERE id=$1", [
						query.groupId,
					])
				: [];
			if (query.groupId && !group) notFound();
			const [{ total, ...summary }]: Array<{
				total: number;
				totalCases: number;
				unsafeCases: number;
				notUsefulCases: number;
				resolvedCases: number;
			}> = await manager.query(
				`SELECT (count(*) FILTER (WHERE ${matches}))::int AS total,
				 count(*)::int AS "totalCases",
				 (count(*) FILTER (WHERE ${unsafeCase}))::int AS "unsafeCases",
				 (count(*) FILTER (WHERE ${notUsefulCase}))::int AS "notUsefulCases",
				 (count(*) FILTER (WHERE c.closed_at IS NOT NULL))::int AS "resolvedCases" ${from}`,
				filters
			);
			const items: (Summary & { questionPreview: string | null })[] = await manager.query(
				`SELECT ${summarySelect}, ${questionPreview} ${from} WHERE ${matches}
				 ORDER BY CASE WHEN $1='UNSAFE' THEN CASE c.review_status WHEN 'pending' THEN 0
				 WHEN 'reviewing' THEN 1 ELSE 2 END END, coalesce(c.reported_at,c.created_at) DESC,c.id DESC
				 LIMIT $5 OFFSET $6`,
				[...filters, limit, (page - 1) * limit]
			);
			return {
				items,
				group: group ?? null,
				summary,
				pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
			};
		});
	}

	async detail(actor: AuthenticatedUser, id: string) {
		ensureInvestigationAdmin(actor);
		const { row, groups, history } = await this.db.transaction(
			"REPEATABLE READ",
			async (manager) => {
				const [row]: CaseDetail[] = await manager.query(
					`SELECT ${summarySelect}, c.feedback_id AS "feedbackId", c.answer_id AS "answerId", c.snapshot,
				 c.report,c.report_reason AS reason,c.evidence_removed_at AS "evidenceRemovedAt",c.version,
				 c.reviewer_id AS "reviewerId",u.full_name AS "reviewerName",c.reviewed_at AS "reviewedAt",
				 c.resolution_note AS "resolutionNote"
				 FROM ai_investigation_cases c JOIN ai_investigation_jobs j ON j.id=c.latest_job_id
				 LEFT JOIN users u ON u.id=c.reviewer_id WHERE c.id=$1`,
					[id]
				);
				if (!row) notFound();
				const groups: Group[] =
					row.report || row.evidenceRemovedAt
						? await manager.query(
								`SELECT g.id,g.classification,m.issue_index AS "issueIndex",
				 (SELECT count(DISTINCT x.case_id)::int FROM ai_investigation_members x
				 JOIN ai_investigation_cases c ON c.id=x.case_id WHERE x.group_id=g.id
				 AND (c.report IS NOT NULL OR c.evidence_removed_at IS NOT NULL)) AS "caseCount"
				 FROM ai_investigation_members m JOIN ai_investigation_groups g ON g.id=m.group_id
				 WHERE m.case_id=$1 ORDER BY m.issue_index`,
								[id]
							)
						: [];
				const history: History[] = await manager.query(
					`SELECT h.version,h.reference,h.verification,h.resolution_note AS "resolutionNote",
				 u.full_name AS "actorName",a.action,a.created_at AS at,
				 a.after->>'technicalStatus' AS "technicalStatus",a.after->>'reviewStatus' AS "reviewStatus"
				 FROM ai_investigation_history h JOIN audit_logs a ON a.id=h.audit_id
				 LEFT JOIN users u ON u.id=a.actor_id WHERE h.case_id=$1 ORDER BY h.version DESC LIMIT 100`,
					[id]
				);
				return { row, groups, history };
			}
		);
		const { snapshot, report, ...summary } = row;
		const sources = snapshot ? await this.evidence.resolve(snapshot) : [];
		const available = new Set(
			sources.filter(({ status }) => status === "AVAILABLE").map(({ evidenceId }) => evidenceId)
		);
		const reportRestricted =
			report?.consideredEvidence.some((evidenceId) => !available.has(evidenceId)) ?? false;
		const visibleReport = reportRestricted ? null : report;
		await this.db.manager.getRepository(AuditLog).insert({
			actorId: actor.userId,
			action: "AI_INVESTIGATION_VIEW",
			targetType: AUDIT_TARGET,
			targetId: id,
		});
		return {
			...summary,
			evidence: snapshot ? snapshotContent(snapshot) : null,
			sources,
			report: visibleReport,
			reportRestricted,
			observations: { unmatchedCitation: !!snapshot && unmatchedCitation(snapshot) !== null },
			groups: reportRestricted ? [] : groups,
			history,
		};
	}

	async update(actor: AuthenticatedUser, id: string, input: unknown) {
		ensureInvestigationAdmin(actor);
		const command = parseAdminAction(input);
		return this.db.transaction(async (manager) => {
			// Match intake's original-feedback then case lock order. The original row is optional.
			await manager.query(
				`SELECT id FROM ai_answer_feedback WHERE id=(
				 SELECT feedback_id FROM ai_investigation_cases WHERE id=$1) FOR UPDATE`,
				[id]
			);
			const [current]: Array<{
				feedback_id: string;
				version: number;
				review_status: Review | null;
				technical_status: Technical;
				closed_at: Date | null;
			}> = await manager.query(
				"SELECT feedback_id,version,review_status,technical_status,closed_at FROM ai_investigation_cases WHERE id=$1 FOR UPDATE",
				[id]
			);
			if (!current) notFound();
			const next = nextReviewState(current, command);
			const version = current.version + 1;
			const resolutionNote = command.action === AdminAction.RESOLVE ? command.resolutionNote : null;
			const [time]: Array<{ at: Date }> = await manager.query("SELECT clock_timestamp() AS at");
			await manager.query(
				`UPDATE ai_investigation_cases SET review_status=$2,technical_status=$3,version=$4,
				 reviewer_id=CASE WHEN $5 THEN $6 ELSE reviewer_id END, reviewed_at=CASE WHEN $5 THEN $7 ELSE reviewed_at END,
				 closed_at=CASE WHEN $8 THEN $7 END,resolution_note=$9 WHERE id=$1`,
				[
					id,
					next.review,
					next.technical,
					version,
					next.recordReviewer,
					actor.userId,
					time.at,
					next.close,
					resolutionNote,
				]
			);
			if (next.recordReviewer)
				await manager.query(
					"UPDATE ai_answer_feedback SET review_status=$2 WHERE id=$1 AND reported_unsafe",
					[current.feedback_id, next.review]
				);
			const audit = await manager.getRepository(AuditLog).save({
				actorId: actor.userId,
				action: `AI_INVESTIGATION_${command.action}`,
				targetType: AUDIT_TARGET,
				targetId: id,
				createdAt: time.at,
				before: {
					reviewStatus: current.review_status,
					technicalStatus: current.technical_status,
					version: current.version,
				},
				after: { reviewStatus: next.review, technicalStatus: next.technical, version },
			});
			await manager.query(
				`INSERT INTO ai_investigation_history(audit_id,case_id,version,reference,verification,resolution_note)
				 VALUES($1,$2,$3,$4,$5,$6)`,
				[
					audit.id,
					id,
					version,
					command.action === AdminAction.START_REVIEW ? null : command.reference,
					command.action === AdminAction.START_REVIEW ? null : command.verification,
					resolutionNote,
				]
			);
			return { id, version, reviewStatus: next.review, technicalStatus: next.technical };
		});
	}
}

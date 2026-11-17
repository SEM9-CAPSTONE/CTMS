import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { CreateAuditLogsTable1786214400000 } from "../src/migrations/1786214400000-CreateAuditLogsTable";
import { CreateSurvivalAiAnswers1795900000000 } from "../src/migrations/1795900000000-CreateSurvivalAiAnswers";
import { CreateAiAnswerFeedback1796300000000 } from "../src/migrations/1796300000000-CreateAiAnswerFeedback";
import { CreateAiInvestigations1796500000000 } from "../src/migrations/1796500000000-CreateAiInvestigations";
import { AiAnswersRepository } from "../src/modules/ai-answers/ai-answers.repository";
import { AiFeedbackService } from "../src/modules/ai-answers/ai-feedback.service";
import { AiInvestigationAdminService } from "../src/modules/ai-investigations/ai-investigation-admin.service";
import {
	AiInvestigationAnalyzer,
	unavailableIssue,
} from "../src/modules/ai-investigations/ai-investigation-analyzer";
import { AiInvestigationEvidence } from "../src/modules/ai-investigations/ai-investigation-evidence";
import { AiInvestigationWorker } from "../src/modules/ai-investigations/ai-investigation-worker";
import type { InvestigationReport } from "../src/modules/ai-investigations/ai-investigation.types";
import { AuditLog } from "../src/modules/auth/entities/audit-log.entity";
import { RagRepository } from "../src/modules/rag/rag.repository";
import { Classification } from "../src/modules/survival-documents/survival-documents.types";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import {
	localInferenceTraceFixture,
	providerInferenceTraceFixture,
} from "./support/inference-trace-fixture";

const camper = { userId: randomUUID(), roles: [UserRole.CAMPER], status: UserStatus.ACTIVE };
const admin = { userId: randomUUID(), roles: [UserRole.ADMIN], status: UserStatus.ACTIVE };
const local = (rating: "USEFUL" | "NOT_USEFUL", reportedUnsafe = false) => ({
	inferenceMode: "LOCAL",
	clientFeedbackId: randomUUID(),
	clientMutationId: randomUUID(),
	installationId: randomUUID(),
	localAnswerId: randomUUID(),
	revision: 1,
	createdAt: new Date().toISOString(),
	question: "Nên chuẩn bị bản đồ như thế nào?",
	answer: "Đối chiếu điểm xuất phát trên bản đồ.",
	modelId: "map-model",
	modelVersion: "1",
	localTrace: localInferenceTraceFixture,
	rating,
	reportedUnsafe,
});
const schema = `ctms073_${randomUUID().replaceAll("-", "")}`;
const report = (): InvestigationReport => ({
	issues: [unavailableIssue()],
	model: "model",
	provider: "openai",
	consideredEvidence: [],
});

describe("CTMS-073 PostgreSQL investigation workflow", () => {
	let root: DataSource;
	let db: DataSource;
	let feedback: AiFeedbackService;
	let review: AiInvestigationAdminService;
	let worker: AiInvestigationWorker;
	let analyze: jest.SpiedFunction<AiInvestigationAnalyzer["analyze"]>;
	let resolve: jest.SpiedFunction<AiInvestigationEvidence["resolve"]>;
	let schemaCreated = false;
	const settings = {
		AI_INVESTIGATION_PROVIDER_ENABLED: "true",
		AI_INVESTIGATION_CLOSED_RETENTION_DAYS: "1",
	};
	let evidence: AiInvestigationEvidence;

	beforeAll(async () => {
		root = await new DataSource({ type: "postgres", url: process.env.DATABASE_URL }).initialize();
		await assertSafeTestDatabase(root);
		await root.query(`CREATE SCHEMA ${schema}`);
		schemaCreated = true;
		db = await new DataSource({
			type: "postgres",
			url: process.env.DATABASE_URL,
			entities: [AuditLog],
			extra: { options: `-c search_path=${schema},public` },
		}).initialize();
		const runner = db.createQueryRunner();
		try {
			await runner.query("CREATE TABLE users (id uuid PRIMARY KEY,email text,full_name text)");
			await runner.query(
				"INSERT INTO users VALUES ($1,'camper@ctms.local','Nguyễn Minh An'),($2,'admin@ctms.local','Trần Thu Hà')",
				[camper.userId, admin.userId]
			);
			await new CreateAuditLogsTable1786214400000().up(runner);
			await new CreateSurvivalAiAnswers1795900000000().up(runner);
			await new CreateAiAnswerFeedback1796300000000().up(runner);
			await new CreateAiInvestigations1796500000000().up(runner);
		} finally {
			await runner.release();
		}
		const config = new ConfigService(settings);
		evidence = new AiInvestigationEvidence(new RagRepository(db));
		const analyzer = new AiInvestigationAnalyzer(config, evidence);
		const providerWorker = new AiInvestigationWorker(db, analyzer, config);
		worker = providerWorker;
		analyze = jest.spyOn(analyzer, "analyze");
		resolve = jest.spyOn(evidence, "resolve");
		feedback = new AiFeedbackService(db, new AiAnswersRepository(db));
		review = new AiInvestigationAdminService(db, evidence);
	}, 30000);

	beforeEach(async () => {
		await db.query(
			"TRUNCATE ai_investigation_cases, ai_investigation_jobs, ai_investigation_groups, ai_feedback_quality_signals, ai_answers, audit_logs CASCADE"
		);
		analyze.mockReset().mockResolvedValue(report());
		resolve.mockReset().mockResolvedValue([]);
		settings.AI_INVESTIGATION_PROVIDER_ENABLED = "true";
	});

	afterAll(async () => {
		if (db?.isInitialized) await db.destroy();
		if (root?.isInitialized) {
			if (schemaCreated) await root.query(`DROP SCHEMA ${schema} CASCADE`);
			await root.destroy();
		}
	});

	const cases = async () => (await review.list(admin, {})).items;
	const caseFor = async (feedbackId: string): Promise<string> => {
		const [found]: Array<{ id: string }> = await db.query(
			"SELECT id FROM ai_investigation_cases WHERE feedback_id=$1",
			[feedbackId]
		);
		return found.id;
	};

	it("persists each effective mutation once, acknowledges before analysis, and drains Unsafe first", async () => {
		const useful = local("USEFUL");
		const notUseful = local("NOT_USEFUL");
		const unsafe = local("USEFUL", true);
		const [{ feedbackId }] = await Promise.all([
			feedback.submit(camper, useful),
			feedback.submit(camper, useful),
		]);
		await feedback.submit(camper, { ...useful, revision: 2, clientMutationId: randomUUID() });
		const lower = await feedback.submit(camper, { ...notUseful, revision: 3 });
		await feedback.submit(camper, {
			...notUseful,
			revision: 2,
			clientMutationId: randomUUID(),
			rating: "USEFUL",
		});
		const urgent = await feedback.submit(camper, unsafe);
		expect(analyze).not.toHaveBeenCalled();
		expect(
			await db.query("SELECT feedback_id FROM ai_investigation_jobs ORDER BY priority")
		).toEqual([
			{ feedback_id: urgent.feedbackId },
			{ feedback_id: lower.feedbackId },
			{ feedback_id: feedbackId },
		]);
		expect((await review.list(admin, { scope: "UNSAFE" })).items).toEqual([
			expect.objectContaining({ processingStatus: "PENDING", reviewStatus: "pending" }),
		]);
		await worker.processNext();
		await worker.processNext();
		await Promise.all([worker.processNext(), worker.processNext()]);
		expect(analyze.mock.calls.map(([job]) => job.feedback_id)).toEqual([
			urgent.feedbackId,
			lower.feedbackId,
		]);
		expect(await cases()).toHaveLength(2);
		expect(await db.query("SELECT useful_only_changes FROM ai_feedback_quality_signals")).toEqual([
			{ useful_only_changes: "1" },
		]);
	});

	it("filters Not Useful before pagination and projects only a bounded question preview", async () => {
		const longQuestion = `Đọc bản đồ\n\t${"đường mòn ".repeat(30)}ở đâu?`;
		const older = await feedback.submit(camper, {
			...local("NOT_USEFUL"),
			question: longQuestion,
			answer: "Đối chiếu tín hiệu GPS.",
		});
		const newer = await feedback.submit(camper, local("NOT_USEFUL"));
		const unsafe = await feedback.submit(camper, local("NOT_USEFUL", true));
		await feedback.submit(camper, local("USEFUL"));
		const olderId = await caseFor(older.feedbackId);
		const newerId = await caseFor(newer.feedbackId);
		const unsafeId = await caseFor(unsafe.feedbackId);
		await db.query("UPDATE ai_investigation_cases SET created_at='2026-10-01' WHERE id=$1", [
			olderId,
		]);
		const first = await review.list(admin, { scope: "NOT_USEFUL", page: 1, limit: 1 });
		expect(first.summary).toEqual({
			totalCases: 3,
			unsafeCases: 1,
			notUsefulCases: 2,
			resolvedCases: 0,
		});
		expect(first.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
		expect(first.items).toEqual([expect.objectContaining({ id: newerId, reviewStatus: null })]);
		const second = await review.list(admin, { scope: "NOT_USEFUL", page: 2, limit: 1 });
		expect(second.items).toEqual([
			expect.objectContaining({
				id: olderId,
				questionPreview: longQuestion.replace(/\s+/g, " ").slice(0, 180),
			}),
		]);
		expect(second.items[0]).not.toHaveProperty("snapshot");
		expect(second.items[0]).not.toHaveProperty("answer");
		for (const q of ["  đường mòn  ", "gps"]) {
			const result = await review.list(admin, { scope: "NOT_USEFUL", q, limit: 1 });
			expect(result.items.map(({ id }) => id)).toEqual([olderId]);
			expect(result.pagination.total).toBe(1);
			expect(result.summary).toEqual(first.summary);
		}
		expect((await review.list(admin, { q: "%" })).items).toEqual([]);
		expect((await review.list(admin, { scope: "UNSAFE" })).items.map(({ id }) => id)).toEqual([
			unsafeId,
		]);
		expect(
			await db.query("SELECT id FROM audit_logs WHERE action='AI_INVESTIGATION_VIEW'")
		).toEqual([]);
	});

	it("rolls back the feedback and receipt if durable capture fails", async () => {
		const input = local("NOT_USEFUL");
		await db.query(
			"ALTER TABLE ai_investigation_cases ADD CONSTRAINT reject_local_fixture CHECK (mode<>'LOCAL')"
		);
		try {
			await expect(feedback.submit(camper, input)).rejects.toMatchObject({ status: 503 });
			expect(
				await db.query("SELECT id FROM ai_answer_feedback WHERE local_answer_id=$1", [
					input.localAnswerId,
				])
			).toEqual([]);
			expect(
				await db.query(
					"SELECT mutation_id FROM ai_answer_feedback_mutations WHERE mutation_id=$1",
					[input.clientMutationId]
				)
			).toEqual([]);
			expect(
				await db.query("SELECT mutation_id FROM ai_investigation_jobs WHERE mutation_id=$1", [
					input.clientMutationId,
				])
			).toEqual([]);
		} finally {
			await db.query("ALTER TABLE ai_investigation_cases DROP CONSTRAINT reject_local_fixture");
		}
	});

	it("fences a stale in-flight worker after accepting an older revision that newly reports Unsafe", async () => {
		const input = local("NOT_USEFUL");
		const accepted = await feedback.submit(camper, { ...input, revision: 3 });
		let finish!: (result: InvestigationReport) => void;
		let announce!: () => void;
		const started = new Promise<void>((ready) => {
			announce = ready;
		});
		analyze.mockImplementationOnce(() => {
			announce();
			return new Promise((ready) => {
				finish = ready;
			});
		});
		const inFlight = worker.processNext();
		await started;
		await feedback.submit(camper, {
			...input,
			clientMutationId: randomUUID(),
			reportedUnsafe: true,
			rating: null,
		});
		await worker.processNext();
		finish({ ...report(), model: "stale-model" });
		await inFlight;
		const detail = await review.detail(admin, await caseFor(accepted.feedbackId));
		expect(detail).toMatchObject({
			rating: "NOT_USEFUL",
			reviewStatus: "pending",
			processingStatus: "COMPLETE",
			report: { model: "model" },
		});
		expect(detail.groups).toHaveLength(1);
		expect(await db.query("SELECT status FROM ai_investigation_jobs ORDER BY id")).toEqual([
			{ status: "SUPERSEDED" },
			{ status: "COMPLETE" },
		]);
	});

	it("retains an expired Online case and persists one of two concurrent reviews, handoff and audit", async () => {
		const [answer]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers
			(user_id,request_id,request_hash,locale,question,answer,retrieved_evidence,cited_chunk_ids,generation,retrieval_config_version)
			VALUES($1,$2,$3,'vi','Nên kiểm tra đường đi thế nào?','Đối chiếu bản đồ.','[]','{}','{}','v1') RETURNING id`,
			[camper.userId, randomUUID(), "a".repeat(64)]
		);
		const accepted = await feedback.submit(camper, {
			inferenceMode: "ONLINE",
			answerId: answer.id,
			clientFeedbackId: randomUUID(),
			clientMutationId: randomUUID(),
			revision: 1,
			createdAt: new Date().toISOString(),
			rating: null,
			reportedUnsafe: true,
		});
		const id = await caseFor(accepted.feedbackId);
		const start = { action: "START_REVIEW", version: 1 };
		const results = await Promise.allSettled([
			review.update(admin, id, start),
			review.update(admin, id, start),
		]);
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(
			await db.query("SELECT review_status FROM ai_answer_feedback WHERE id=$1", [
				accepted.feedbackId,
			])
		).toEqual([{ review_status: "reviewing" }]);
		await db.query("UPDATE ai_answers SET expires_at=clock_timestamp() WHERE id=$1", [answer.id]);
		await feedback.purgeExpired();
		expect(
			await db.query("SELECT id FROM ai_answer_feedback WHERE id=$1", [accepted.feedbackId])
		).toEqual([]);
		await worker.purgeClosedEvidence();
		expect(await review.detail(admin, id)).toMatchObject({
			answerId: answer.id,
			feedbackId: accepted.feedbackId,
			evidence: {
				question: "Nên kiểm tra đường đi thế nào?",
				answer: "Đối chiếu bản đồ.",
				trace: null,
			},
			reviewerId: admin.userId,
		});
		expect(await cases()).toEqual([
			expect.objectContaining({ id, questionPreview: "Nên kiểm tra đường đi thế nào?" }),
		]);
		const justification = {
			reference: "CTMS-261",
			verification: "Đối chiếu bản ghi phát hành và biên bản tái hiện.",
		};
		await review.update(admin, id, { action: "HANDOFF", version: 2, ...justification });
		expect(await review.detail(admin, id)).toMatchObject({
			reviewStatus: "reviewing",
			technicalStatus: "HANDED_OFF",
			closedAt: null,
		});
		await review.update(admin, id, {
			action: "RESOLVE",
			version: 3,
			...justification,
			disposition: "JUSTIFIED_NO_FIX",
			resolutionNote: "Bản ghi độc lập xác nhận dữ liệu nguồn đúng.",
		});
		await db.query(
			"UPDATE ai_investigation_cases SET closed_at=clock_timestamp()-interval '2 days',retention_hold=true WHERE id=$1",
			[id]
		);
		await worker.purgeClosedEvidence();
		expect((await review.detail(admin, id)).evidence).not.toBeNull();
		await db.query("UPDATE ai_investigation_cases SET retention_hold=false WHERE id=$1", [id]);
		await worker.purgeClosedEvidence();
		expect(await cases()).toEqual([expect.objectContaining({ id, questionPreview: null })]);
		const afterPurge = await review.list(admin, { q: "kiểm tra đường đi" });
		expect(afterPurge.items).toEqual([]);
		expect(afterPurge.summary).toEqual({
			totalCases: 1,
			unsafeCases: 1,
			notUsefulCases: 0,
			resolvedCases: 1,
		});
		expect(await review.detail(admin, id)).toMatchObject({
			reviewStatus: "actioned",
			evidence: null,
			evidenceRemovedAt: expect.any(Date),
			history: [
				{ reference: "CTMS-261", action: "AI_INVESTIGATION_RESOLVE" },
				{ action: "AI_INVESTIGATION_HANDOFF" },
				{ action: "AI_INVESTIGATION_START_REVIEW" },
			],
		});
		expect(
			await db.query(
				`SELECT "after" FROM audit_logs WHERE target_id=$1 AND action='AI_INVESTIGATION_RESOLVE'`,
				[id]
			)
		).toEqual([
			{ after: { reviewStatus: "actioned", technicalStatus: "JUSTIFIED_NO_FIX", version: 4 } },
		]);
	});

	it("coalesces exact evidence divergence, with singleton groups for unrelated cases", async () => {
		const missing = randomUUID();
		const source = {
			chunkId: randomUUID(),
			chunkIndex: 0,
			fingerprint: "a".repeat(64),
			locations: [{ page: 1, itemRef: "p1" }],
			source: {
				documentId: randomUUID(),
				documentVersionId: randomUUID(),
				chunkSetId: randomUUID(),
				sourceVersion: 1,
				checksum: "b".repeat(64),
				locale: "vi",
				sourceTitle: "Đọc bản đồ",
				classification: Classification.TREKKING_SAFETY,
			},
		};
		const create = async (cited: string) => {
			const [answer]: Array<{ id: string }> = await db.query(
				`INSERT INTO ai_answers
				(user_id,request_id,request_hash,locale,answer,retrieved_evidence,cited_chunk_ids,generation,retrieval_config_version)
				VALUES($1,$2,$3,'vi','Đối chiếu bản đồ.',$4::jsonb,$5::uuid[],$6::jsonb,'v1') RETURNING id`,
				[
					camper.userId,
					randomUUID(),
					"a".repeat(64),
					JSON.stringify([source]),
					[cited],
					JSON.stringify({
						promptVersion: "ctms-069-grounded-v2",
						trace: { ...providerInferenceTraceFixture, schemaVersion: 1 },
					}),
				]
			);
			const accepted = await feedback.submit(camper, {
				inferenceMode: "ONLINE",
				answerId: answer.id,
				clientFeedbackId: randomUUID(),
				clientMutationId: randomUUID(),
				revision: 1,
				createdAt: new Date().toISOString(),
				rating: "NOT_USEFUL",
				reportedUnsafe: false,
			});
			return caseFor(accepted.feedbackId);
		};
		const ids = await Promise.all([create(missing), create(missing), create(randomUUID())]);
		analyze.mockResolvedValue({
			...report(),
			issues: [{ ...unavailableIssue(), classification: "SOURCE_MISMATCH" }],
		});
		await Promise.all(ids.map(() => worker.processNext()));
		const details = await Promise.all(ids.map((id) => review.detail(admin, id)));
		expect(details[0].groups[0]).toMatchObject({ caseCount: 2 });
		expect(details[0].groups[0].id).toBe(details[1].groups[0].id);
		expect(details[0].groups[0].id).not.toBe(details[2].groups[0].id);
		expect((await review.list(admin, { groupId: details[0].groups[0].id })).pagination.total).toBe(
			2
		);
	});

	it("leaves cases readable on provider failure and hides a report if its source was withdrawn", async () => {
		const accepted = await feedback.submit(camper, local("NOT_USEFUL", true));
		const id = await caseFor(accepted.feedbackId);
		analyze.mockRejectedValue(new Error("Provider unavailable"));
		for (let i = 0; i < 3; i += 1) {
			await worker.processNext();
			await db.query(
				"UPDATE ai_investigation_jobs SET available_at=clock_timestamp() WHERE feedback_id=$1",
				[accepted.feedbackId]
			);
		}
		expect(await worker.processNext()).toBe(false);
		expect(await review.detail(admin, id)).toMatchObject({
			reviewStatus: "pending",
			processingStatus: "FAILED",
			evidence: { provenance: "CLIENT_REPORTED", trace: localInferenceTraceFixture },
			report: { issues: [{ classification: "UNDETERMINED" }] },
		});
		await db.query(
			"UPDATE ai_investigation_cases SET report=jsonb_set(report,'{consideredEvidence}','[1]') WHERE id=$1",
			[id]
		);
		resolve.mockResolvedValue([{ evidenceId: 1, cited: true, status: "UNAVAILABLE" }]);
		expect(await review.detail(admin, id)).toMatchObject({ report: null, reportRestricted: true });
	});
});

import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DataSource } from "typeorm";
import {
	createSurvivalE2eApp,
	sourceTestEmail,
	sourceTestPassword,
} from "./support/survival-e2e-app";

const endpoint = "/api/admin/ai-investigations";
const feedbackEndpoint = "/api/ai/answers/feedback";

describe("CTMS-073 investigation HTTP contract", () => {
	let app: INestApplication;
	let db: DataSource;
	let root: string;
	let admin: string;
	let camper: string;
	let adminId: string;
	const feedbackIds: string[] = [];
	const answerIds: string[] = [];
	const cases: string[] = [];

	beforeAll(async () => {
		const setup = await createSurvivalE2eApp();
		app = setup.app;
		root = setup.storageRoot;
		db = app.get(DataSource);
		const login = async (role: string): Promise<string> =>
			(
				await request(app.getHttpServer())
					.post("/api/auth/login")
					.send({ identifier: sourceTestEmail(role), password: sourceTestPassword })
					.expect(200)
			).body.accessToken;
		admin = await login("admin");
		camper = await login("camper");
		const [user]: Array<{ id: string }> = await db.query("SELECT id FROM users WHERE email=$1", [
			sourceTestEmail("admin"),
		]);
		adminId = user.id;
	}, 90000);

	afterAll(async () => {
		try {
			if (db && feedbackIds.length) {
				await db.query("DELETE FROM ai_investigation_cases WHERE feedback_id=ANY($1::uuid[])", [
					feedbackIds,
				]);
				await db.query(
					"DELETE FROM audit_logs WHERE target_type='AI_INVESTIGATION' AND target_id=ANY($1::uuid[])",
					[cases]
				);
				await db.query("DELETE FROM ai_investigation_jobs WHERE feedback_id=ANY($1::uuid[])", [
					feedbackIds,
				]);
				await db.query("DELETE FROM ai_answer_feedback WHERE id=ANY($1::uuid[])", [feedbackIds]);
				await db.query("DELETE FROM ai_answers WHERE id=ANY($1::uuid[])", [answerIds]);
			}
		} finally {
			await app?.close();
			if (root) await rm(root, { recursive: true, force: true });
		}
	});

	const get = (path: string) =>
		request(app.getHttpServer()).get(path).auth(admin, { type: "bearer" });
	const patch = (id: string, body: Record<string, unknown>) =>
		request(app.getHttpServer())
			.patch(`${endpoint}/${id}`)
			.auth(admin, { type: "bearer" })
			.send(body);

	async function submit(payload: Record<string, unknown>) {
		const accepted = await request(app.getHttpServer())
			.post(feedbackEndpoint)
			.auth(camper, { type: "bearer" })
			.send({
				clientFeedbackId: randomUUID(),
				clientMutationId: randomUUID(),
				revision: 1,
				createdAt: new Date().toISOString(),
				...payload,
			})
			.expect(200);
		const feedbackId = accepted.body.feedbackId as string;
		feedbackIds.push(feedbackId);
		const [row]: Array<{ id: string }> = await db.query(
			"SELECT id FROM ai_investigation_cases WHERE feedback_id=$1",
			[feedbackId]
		);
		cases.push(row.id);
		return row.id;
	}

	const local = (reportedUnsafe: boolean) => ({
		inferenceMode: "LOCAL",
		installationId: randomUUID(),
		localAnswerId: randomUUID(),
		question: "Kiểm tra đường đi thế nào?",
		answer: "Đối chiếu bản đồ giấy.",
		rating: "NOT_USEFUL",
		reportedUnsafe,
	});

	it("requires an authenticated Admin for list, report and review updates", async () => {
		const id = randomUUID();
		await request(app.getHttpServer()).get(endpoint).expect(401);
		await request(app.getHttpServer())
			.get(`${endpoint}/${id}`)
			.auth(camper, { type: "bearer" })
			.expect(403);
		await request(app.getHttpServer())
			.patch(`${endpoint}/${id}`)
			.auth(camper, { type: "bearer" })
			.send({ action: "START_REVIEW", version: 1 })
			.expect(403);
		await get(`${endpoint}/${id}`).expect(404);
		await get(`${endpoint}?scope=unknown`).expect(422);
	});

	it("keeps Unsafe available when analysis is unavailable and enforces substantiated completion", async () => {
		const id = await submit(local(true));
		const notUseful = await submit(local(false));
		const [legacy]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers
			(user_id,request_id,request_hash,locale,answer,retrieved_evidence,cited_chunk_ids,generation,retrieval_config_version)
			SELECT id,$2,$3,'vi','Đối chiếu bản đồ.','[]','{}','{}','v1' FROM users WHERE email=$1 RETURNING id`,
			[sourceTestEmail("camper"), randomUUID(), "a".repeat(64)]
		);
		answerIds.push(legacy.id);
		const legacyId = await submit({
			inferenceMode: "ONLINE",
			answerId: legacy.id,
			rating: "NOT_USEFUL",
			reportedUnsafe: false,
		});
		await db.query(
			`UPDATE ai_investigation_jobs SET status='FAILED' WHERE id=(SELECT latest_job_id FROM ai_investigation_cases WHERE id=$1)`,
			[id]
		);
		const queue = await get(`${endpoint}?scope=UNSAFE&reviewStatus=pending&limit=50`).expect(200);
		expect(queue.body.items).toEqual(
			expect.arrayContaining([expect.objectContaining({ id, processingStatus: "FAILED" })])
		);
		expect(queue.body.items).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ id: notUseful })])
		);
		expect((await get(`${endpoint}/${legacyId}`).expect(200)).body).toMatchObject({
			reviewStatus: null,
			evidence: { provenance: "SERVER_RECORDED", question: null, trace: null },
			sources: [],
		});
		expect((await get(`${endpoint}/${id}`).expect(200)).body).toMatchObject({
			version: 1,
			reviewStatus: "pending",
			evidence: { provenance: "CLIENT_REPORTED", trace: null },
		});
		const resolution = {
			action: "RESOLVE",
			version: 1,
			disposition: "VERIFIED_FIX",
			reference: "CTMS-343",
			verification:
				"Đã kiểm tra lại tình huống với tài liệu được duyệt và ghi nhận kết quả tái hiện.",
			resolutionNote: "Bản sửa đã đưa ra chỉ dẫn đầy đủ.",
		};
		await patch(id, resolution).expect(409);
		await patch(notUseful, { action: "START_REVIEW", version: 1 }).expect(409);
		await patch(id, { action: "START_REVIEW", version: 1, reviewerId: randomUUID() }).expect(422);
		await patch(id, { action: "START_REVIEW", version: 1 }).expect(200);
		await patch(id, { action: "START_REVIEW", version: 1 }).expect(409);
		await patch(id, {
			action: "HANDOFF",
			version: 2,
			reference: "https://github.com/SEM9-CAPSTONE/CTMS/issues/343",
			verification: "Đối chiếu hướng dẫn an toàn đã dùng để tạo câu trả lời.",
		}).expect(200);
		expect((await get(`${endpoint}/${id}`).expect(200)).body).toMatchObject({
			reviewerId: adminId,
			reviewedAt: expect.any(String),
			reviewStatus: "reviewing",
			technicalStatus: "HANDED_OFF",
			closedAt: null,
		});
		await patch(id, { ...resolution, version: 3, resolutionNote: " " }).expect(422);
		await patch(id, { ...resolution, version: 3 }).expect(200);
		expect((await get(`${endpoint}/${id}`).expect(200)).body).toMatchObject({
			reviewStatus: "actioned",
			technicalStatus: "VERIFIED_FIX",
			resolutionNote: resolution.resolutionNote,
			reviewerId: adminId,
			history: [
				{ action: "AI_INVESTIGATION_RESOLVE" },
				{ action: "AI_INVESTIGATION_HANDOFF" },
				{ action: "AI_INVESTIGATION_START_REVIEW" },
			],
		});
	});
});

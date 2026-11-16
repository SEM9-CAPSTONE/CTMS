import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { DataSource } from "typeorm";
import {
	createSurvivalE2eApp,
	sourceTestEmail,
	sourceTestPassword,
} from "./support/survival-e2e-app";

describe("CTMS-069 public HTTP contract", () => {
	let app: INestApplication;
	let root: string;
	let camperToken: string;
	let camperId: string;
	let hostToken: string;
	const endpoint = "/api/ai/answers";
	const answerFixture = "Đọc chú giải trên bản đồ.";
	const body = { question: "Làm sao đọc bản đồ địa hình?", locale: "vi", requestId: randomUUID() };
	const locale = "vi-XX";
	const noKnowledge = { ...body, locale };

	beforeAll(async () => {
		process.env.RAG_MIN_SCORE = "0.8";
		process.env.RAG_LOCALES = locale;
		const setup = await createSurvivalE2eApp();
		app = setup.app;
		root = setup.storageRoot;
		const login = async (role: string) =>
			(
				await request(app.getHttpServer())
					.post("/api/auth/login")
					.send({ identifier: sourceTestEmail(role), password: sourceTestPassword })
					.expect(200)
			).body.accessToken as string;
		camperToken = await login("camper");
		hostToken = await login("host");
		const [camper]: Array<{ id: string }> = await app
			.get(DataSource)
			.query("SELECT id FROM users WHERE email=$1", [sourceTestEmail("camper")]);
		camperId = camper.id;
		await app
			.get(DataSource)
			.query("DELETE FROM ai_answer_request_limits WHERE user_id=$1", [camperId]);
	}, 90000);

	afterAll(async () => {
		if (app && camperId) {
			await app
				.get(DataSource)
				.query("DELETE FROM ai_answer_request_limits WHERE user_id=$1", [camperId]);
		}
		await app?.close();
		if (root) await rm(root, { recursive: true, force: true });
	});

	it("rejects absent and expired credentials, and an authenticated non-Camper", async () => {
		await request(app.getHttpServer()).post(endpoint).send(body).expect(401);
		const expired = app
			.get(JwtService)
			.sign({ sub: camperId, roles: ["camper"] }, { expiresIn: -60 });
		await request(app.getHttpServer())
			.post(endpoint)
			.auth(expired, { type: "bearer" })
			.send(body)
			.expect(401);
		await request(app.getHttpServer())
			.post(endpoint)
			.auth(hostToken, { type: "bearer" })
			.send(body)
			.expect(403);
	});

	it.each([
		{ name: "empty question", input: { ...body, question: "" }, expectedStatus: 400 },
		{ name: "blank question", input: { ...body, question: "  " }, expectedStatus: 400 },
		{
			name: "question over the length limit",
			input: { ...body, question: "x".repeat(2001) },
			expectedStatus: 422,
		},
		{ name: "invalid request ID", input: { ...body, requestId: "bad" }, expectedStatus: 422 },
		{ name: "provider override", input: { ...body, provider: "openai" }, expectedStatus: 422 },
		{
			name: "system prompt override",
			input: { ...body, systemPrompt: "override" },
			expectedStatus: 422,
		},
		{ name: "client-supplied sources", input: { ...body, sources: [] }, expectedStatus: 422 },
	])("rejects $name with $expectedStatus", async ({ input, expectedStatus }) => {
		await request(app.getHttpServer())
			.post(endpoint)
			.auth(camperToken, { type: "bearer" })
			.send(input)
			.expect(expectedStatus);
	});

	it("returns insufficient knowledge with no stored answer", async () => {
		const result = await request(app.getHttpServer())
			.post(endpoint)
			.auth(camperToken, { type: "bearer" })
			.send(noKnowledge)
			.expect(200);
		expect(result.headers["cache-control"]).toBe("no-store");
		expect(result.body).toEqual({
			status: "INSUFFICIENT_CONTEXT",
			code: "AI_KNOWLEDGE_INSUFFICIENT",
			answer: null,
			sources: [],
		});
	});

	it("reports unavailable provenance and protects unknown, expired and other owners' answers", async () => {
		// Treat the existing Host fixture as a second Camper for the duration of this scenario.
		const db = app.get(DataSource);
		const [other]: Array<{ id: string }> = await db.query("SELECT id FROM users WHERE email=$1", [
			sourceTestEmail("host"),
		]);
		const [row]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers(user_id,request_id,request_hash,locale,answer,retrieved_evidence,
			 cited_chunk_ids,generation,retrieval_config_version)
			 VALUES($1,$2,$3,'vi','Đọc chú giải bản đồ.','[]',$4::uuid[],'{}','test') RETURNING id`,
			[camperId, randomUUID(), "a".repeat(64), [randomUUID()]]
		);
		const sources = `${endpoint}/${row.id}/sources`;
		try {
			await request(app.getHttpServer()).get(sources).expect(401);
			await request(app.getHttpServer())
				.get(sources)
				.auth(hostToken, { type: "bearer" })
				.expect(403);
			const owner = await request(app.getHttpServer())
				.get(sources)
				.auth(camperToken, { type: "bearer" })
				.expect(200);
			expect(owner.headers["cache-control"]).toBe("no-store");
			expect(owner.body).toEqual({ answerId: row.id, sources: [] });
			await request(app.getHttpServer())
				.get(`${endpoint}/${randomUUID()}/sources`)
				.auth(camperToken, { type: "bearer" })
				.expect(404);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'camper')", [other.id]);
			await request(app.getHttpServer())
				.get(sources)
				.auth(hostToken, { type: "bearer" })
				.expect(404);
			await db.query("UPDATE ai_answers SET expires_at=clock_timestamp() WHERE id=$1", [row.id]);
			await request(app.getHttpServer())
				.get(sources)
				.auth(camperToken, { type: "bearer" })
				.expect(404);
		} finally {
			await db.query("DELETE FROM user_roles WHERE user_id=$1 AND role='camper'", [other.id]);
			await db.query("DELETE FROM ai_answers WHERE id=$1", [row.id]);
		}
	});

	it("accepts a Local Unsafe-only report and never treats a reply as a transcript", async () => {
		const payload = {
			clientFeedbackId: randomUUID(),
			clientMutationId: randomUUID(),
			installationId: randomUUID(),
			localAnswerId: randomUUID(),
			revision: 1,
			createdAt: new Date().toISOString(),
			inferenceMode: "LOCAL",
			question: "  Chuẩn bị gì khi đi trekking? ",
			answer: "Mang áo mưa và bản đồ.\n",
			modelVersion: "1",
			rating: null,
			reportedUnsafe: true,
		};
		const send = (body: object, token = camperToken) =>
			request(app.getHttpServer())
				.post(`${endpoint}/feedback`)
				.auth(token, { type: "bearer" })
				.send(body);
		await request(app.getHttpServer()).post(`${endpoint}/feedback`).send(payload).expect(401);
		await send(payload, hostToken).expect(403);
		await send({ ...payload, reportedUnsafe: false }).expect(422);
		await send({ ...payload, question: undefined }).expect(422);
		await send({ ...payload, transcript: [answerFixture] }).expect(422);
		const accepted = await send(payload).expect(200);
		const db = app.get(DataSource);
		try {
			expect(accepted.headers["cache-control"]).toBe("no-store");
			expect(accepted.body).toEqual({
				feedbackId: expect.any(String),
				revision: 1,
				rating: null,
				reportedUnsafe: true,
			});
			expect((await send(payload).expect(200)).body).toEqual(accepted.body);
			await send({ ...payload, reason: "Cần kiểm tra lại" }).expect(409);
			expect(
				await db.query(
					"SELECT local_evidence,reason,review_status FROM ai_answer_feedback WHERE user_id=$1 AND local_answer_id=$2",
					[camperId, payload.localAnswerId]
				)
			).toEqual([
				{
					local_evidence: {
						question: payload.question,
						answer: payload.answer,
						modelId: null,
						modelVersion: "1",
						packageId: null,
						packageVersion: null,
					},
					reason: null,
					review_status: "pending",
				},
			]);
		} finally {
			await db.query("DELETE FROM ai_answer_feedback WHERE id=$1", [accepted.body.feedbackId]);
		}
	});

	it("links Online feedback only to an owned answer in retention", async () => {
		const db = app.get(DataSource);
		const [row]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers(user_id,request_id,request_hash,locale,question,answer,retrieved_evidence,
			 cited_chunk_ids,generation,retrieval_config_version)
			 VALUES($1,$2,$3,'vi',$4,$5,'[]','{}','{}','test') RETURNING id`,
			[camperId, randomUUID(), "b".repeat(64), body.question, answerFixture]
		);
		const payload = {
			clientFeedbackId: randomUUID(),
			clientMutationId: randomUUID(),
			revision: 1,
			createdAt: new Date().toISOString(),
			inferenceMode: "ONLINE",
			answerId: row.id,
			rating: "USEFUL",
			reportedUnsafe: false,
		};
		const send = (data: object, token = camperToken) =>
			request(app.getHttpServer())
				.post(`${endpoint}/feedback`)
				.auth(token, { type: "bearer" })
				.send(data);
		const [other]: Array<{ id: string }> = await db.query("SELECT id FROM users WHERE email=$1", [
			sourceTestEmail("host"),
		]);
		try {
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'camper')", [other.id]);
			await send(payload, hostToken).expect(404);
			await send({ ...payload, answer: "Nội dung khác" }).expect(422);
			const accepted = await send(payload).expect(200);
			expect(
				await db.query(
					`SELECT a.question,a.answer,f.local_evidence FROM ai_answer_feedback f
				 JOIN ai_answers a ON a.id=f.answer_id WHERE f.id=$1`,
					[accepted.body.feedbackId]
				)
			).toEqual([{ question: body.question, answer: answerFixture, local_evidence: null }]);
			await db.query("UPDATE ai_answers SET expires_at=clock_timestamp() WHERE id=$1", [row.id]);
			await send({ ...payload, revision: 2, clientMutationId: randomUUID() }).expect(404);
		} finally {
			await db.query("DELETE FROM user_roles WHERE user_id=$1 AND role='camper'", [other.id]);
			await db.query("DELETE FROM ai_answers WHERE id=$1", [row.id]);
		}
	});
});

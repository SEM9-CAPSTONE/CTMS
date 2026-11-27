import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { DataSource } from "typeorm";
import {
	localInferenceTraceFixture,
	providerInferenceTraceFixture,
} from "./support/inference-trace-fixture";
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
		process.env.RAG_SOURCE_LOCALES = locale;
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

	it("CTMS-075 independently interrupts a direct question and follows its context", async () => {
		const ask = (question: string, emergencyContext?: string) =>
			request(app.getHttpServer())
				.post(endpoint)
				.auth(camperToken, { type: "bearer" })
				.send({ question, requestId: randomUUID(), locale: "vi", emergencyContext });
		const initial = await ask("Bạn tôi bất tỉnh.").expect(200);
		expect(initial.headers["cache-control"]).toBe("no-store");
		expect(initial.body).toMatchObject({
			status: "SAFETY_ASSESSMENT",
			severity: "EMERGENCY",
			protocol: null,
			answer: null,
			sources: [],
			emergencyContext: expect.any(String),
		});
		expect(
			(await ask("Tôi phải làm gì tiếp?", initial.body.emergencyContext).expect(200)).body
		).toMatchObject({ severity: "EMERGENCY" });
		await ask("Tôi phải làm gì tiếp?", "invalid").expect(400);
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
		{
			name: "client-supplied source locale",
			input: { ...body, sourceLocales: ["en"] },
			expectedStatus: 422,
		},
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

	it("returns the original English citation for a stored Vietnamese answer", async () => {
		const db = app.get(DataSource);
		const chunkId = randomUUID();
		const source = {
			documentId: randomUUID(),
			documentVersionId: randomUUID(),
			chunkSetId: randomUUID(),
			sourceVersion: 2,
			sourceTitle: "Fictional hiking guide",
			classification: "TREKKING_SAFETY",
			locale: "en",
		};
		const locations = [{ page: 3, itemRef: "#/texts/4" }];
		const [row]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers(user_id,request_id,request_hash,locale,answer,retrieved_evidence,
			 cited_chunk_ids,generation,retrieval_config_version)
			 VALUES($1,$2,$3,'vi',$4,$5,$6::uuid[],'{}','test') RETURNING id`,
			[
				camperId,
				randomUUID(),
				"e".repeat(64),
				answerFixture,
				JSON.stringify([{ chunkId, chunkIndex: 0, source, locations }]),
				[chunkId],
			]
		);
		try {
			const response = await request(app.getHttpServer())
				.get(`${endpoint}/${row.id}/sources`)
				.auth(camperToken, { type: "bearer" })
				.expect(200);
			expect(response.body.sources).toMatchObject([
				{
					locale: "en",
					documentVersionId: source.documentVersionId,
					sourceVersion: 2,
					chunkId,
					locations,
				},
			]);
		} finally {
			await db.query("DELETE FROM ai_answers WHERE id=$1", [row.id]);
		}
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

	it.each([undefined, localInferenceTraceFixture])(
		"accepts a legacy or traced Local Unsafe-only report (%#)",
		async (localTrace) => {
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
				...(localTrace ? { localTrace } : {}),
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
							...(localTrace ? { localTrace } : {}),
						},
						reason: null,
						review_status: "pending",
					},
				]);
			} finally {
				await db.query("DELETE FROM ai_answer_feedback WHERE id=$1", [accepted.body.feedbackId]);
			}
		}
	);

	it.each(["traced", "legacy"])("links %s Online feedback to its answer", async (variant) => {
		const db = app.get(DataSource);
		const question = variant === "traced" ? body.question : null;
		const generation = {
			provider: "openai",
			model: "test-model",
			...(variant === "traced" ? { trace: providerInferenceTraceFixture } : {}),
		};
		const [row]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers(user_id,request_id,request_hash,locale,question,answer,retrieved_evidence,
			 cited_chunk_ids,generation,retrieval_config_version)
			 VALUES($1,$2,$3,'vi',$4,$5,'[]','{}',$6::jsonb,'test') RETURNING id`,
			[camperId, randomUUID(), "b".repeat(64), question, answerFixture, JSON.stringify(generation)]
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
			await send({ ...payload, localTrace: localInferenceTraceFixture }).expect(422);
			const accepted = await send(payload).expect(200);
			expect(accepted.body).toMatchObject({
				revision: 1,
				rating: "USEFUL",
				reportedUnsafe: false,
			});
			const change = {
				...payload,
				revision: 2,
				clientMutationId: randomUUID(),
				rating: "NOT_USEFUL",
			};
			const updated = await send(change).expect(200);
			expect(updated.body).toEqual({
				feedbackId: accepted.body.feedbackId,
				revision: 2,
				rating: "NOT_USEFUL",
				reportedUnsafe: false,
			});
			expect((await send(change).expect(200)).body).toEqual(updated.body);
			expect(
				await db.query(
					`SELECT a.question,a.answer,a.generation,f.rating,f.local_evidence FROM ai_answer_feedback f
				 JOIN ai_answers a ON a.id=f.answer_id WHERE f.id=$1`,
					[accepted.body.feedbackId]
				)
			).toEqual([
				{
					question,
					answer: answerFixture,
					generation,
					rating: "NOT_USEFUL",
					local_evidence: null,
				},
			]);
			await db.query("UPDATE ai_answers SET expires_at=clock_timestamp() WHERE id=$1", [row.id]);
			await send({ ...payload, revision: 3, clientMutationId: randomUUID() }).expect(404);
		} finally {
			await db.query("DELETE FROM user_roles WHERE user_id=$1 AND role='camper'", [other.id]);
			await db.query("DELETE FROM ai_answers WHERE id=$1", [row.id]);
		}
	});
});

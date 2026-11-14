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

	it("does not disclose another Camper's saved answer, or any expired answer", async () => {
		// Treat the existing Host fixture as a second Camper for the duration of this scenario.
		const db = app.get(DataSource);
		const [other]: Array<{ id: string }> = await db.query("SELECT id FROM users WHERE email=$1", [
			sourceTestEmail("host"),
		]);
		const [row]: Array<{ id: string }> = await db.query(
			`INSERT INTO ai_answers(user_id,request_id,request_hash,locale,answer,retrieved_evidence,
			 cited_chunk_ids,generation,retrieval_config_version)
			 VALUES($1,$2,$3,'vi','Đọc chú giải bản đồ.','[]','{}','{}','test') RETURNING id`,
			[camperId, randomUUID(), "a".repeat(64)]
		);
		const sources = `${endpoint}/${row.id}/sources`;
		try {
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
});

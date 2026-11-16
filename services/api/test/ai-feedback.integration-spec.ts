import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { ConflictException, type INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AiFeedbackService } from "../src/modules/ai-answers/ai-feedback.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { createSurvivalE2eApp, sourceTestEmail } from "./support/survival-e2e-app";

describe("CTMS-341 feedback PostgreSQL integration", () => {
	let app: INestApplication;
	let root: string;
	let db: DataSource;
	let service: AiFeedbackService;
	let actor: { userId: string; roles: UserRole[]; status: UserStatus };
	const feedbackIds: string[] = [];

	beforeAll(async () => {
		const setup = await createSurvivalE2eApp();
		app = setup.app;
		root = setup.storageRoot;
		db = app.get(DataSource);
		service = app.get(AiFeedbackService);
		const [camper]: Array<{ id: string }> = await db.query("SELECT id FROM users WHERE email=$1", [
			sourceTestEmail("camper"),
		]);
		actor = { userId: camper.id, roles: [UserRole.CAMPER], status: UserStatus.ACTIVE };
	}, 90000);

	afterAll(async () => {
		try {
			if (db && feedbackIds.length) {
				await db.query("DELETE FROM ai_answer_feedback WHERE id=ANY($1::uuid[])", [feedbackIds]);
			}
		} finally {
			await app?.close();
			if (root) await rm(root, { recursive: true, force: true });
		}
	});

	const local = () => ({
		inferenceMode: "LOCAL",
		clientFeedbackId: randomUUID(),
		clientMutationId: randomUUID(),
		installationId: randomUUID(),
		localAnswerId: randomUUID(),
		revision: 1,
		createdAt: new Date().toISOString(),
		question: "Xếp ba lô thế nào?",
		answer: "Đặt đồ nặng gần lưng.\n",
		modelId: "packing-model",
		modelVersion: "1",
		rating: "USEFUL",
		reportedUnsafe: false,
	});

	it("deduplicates concurrent replay and protects a newer rating from a delayed revision", async () => {
		const first = local();
		const latest = { ...first, clientMutationId: randomUUID(), revision: 3, rating: "NOT_USEFUL" };
		const acks = await Promise.all(
			[latest, latest, first].map((payload) => service.submit(actor, payload))
		);
		const feedbackId = acks[0].feedbackId;
		feedbackIds.push(feedbackId);
		expect(acks.every((ack) => ack.feedbackId === feedbackId)).toBe(true);
		expect(await service.submit(actor, latest)).toEqual(acks[0]);
		const stale = await service.submit(actor, {
			...first,
			revision: 2,
			clientMutationId: randomUUID(),
		});
		expect(stale).toMatchObject({ revision: 3, rating: "NOT_USEFUL" });
		expect(
			await db.query(
				"SELECT rating,local_evidence FROM ai_answer_feedback WHERE local_answer_id=$1",
				[first.localAnswerId]
			)
		).toEqual([
			{
				rating: "NOT_USEFUL",
				local_evidence: {
					question: first.question,
					answer: first.answer,
					modelId: first.modelId,
					modelVersion: first.modelVersion,
					packageId: null,
					packageVersion: null,
				},
			},
		]);
		expect(
			await db.query(
				"SELECT count(*)::int AS count FROM ai_answer_feedback_mutations WHERE feedback_id=$1",
				[feedbackId]
			)
		).toEqual([{ count: 3 }]);
		await expect(service.submit(actor, { ...latest, rating: "USEFUL" })).rejects.toBeInstanceOf(
			ConflictException
		);
		await expect(
			service.submit(actor, {
				...latest,
				revision: 4,
				clientMutationId: randomUUID(),
				question: "Một câu khác",
			})
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("preserves independent review evidence for a delayed Unsafe-only report and purges receipts with expiry", async () => {
		const first = local();
		const rated = await service.submit(actor, { ...first, revision: 2 });
		feedbackIds.push(rated.feedbackId);
		const report = {
			...first,
			clientMutationId: randomUUID(),
			rating: null,
			reportedUnsafe: true,
			reason: "Thiếu cảnh báo",
		};
		await service.submit(actor, report);
		await service.submit(actor, {
			...first,
			revision: 3,
			clientMutationId: randomUUID(),
			rating: "NOT_USEFUL",
		});
		const rows: unknown[] = await db.query(
			"SELECT rating,reported_unsafe,reason,review_status FROM ai_answer_feedback WHERE id=$1",
			[rated.feedbackId]
		);
		expect(rows).toEqual([
			{
				rating: "NOT_USEFUL",
				reported_unsafe: true,
				reason: report.reason,
				review_status: "pending",
			},
		]);
		await db.query(
			"UPDATE ai_answer_feedback SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
			[rated.feedbackId]
		);
		await service.purgeExpired();
		expect(
			await db.query("SELECT id FROM ai_answer_feedback WHERE id=$1", [rated.feedbackId])
		).toEqual([]);
		expect(
			await db.query("SELECT mutation_id FROM ai_answer_feedback_mutations WHERE feedback_id=$1", [
				rated.feedbackId,
			])
		).toEqual([]);
	});
});

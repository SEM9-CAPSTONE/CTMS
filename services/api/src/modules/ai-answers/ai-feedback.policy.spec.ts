import { randomUUID } from "node:crypto";
import { UnprocessableEntityException } from "@nestjs/common";
import { localInferenceTraceFixture } from "../../../test/support/inference-trace-fixture";
import { feedbackInput } from "./ai-feedback.policy";

const now = Date.parse("2026-11-16T01:00:00Z");
const online = {
	clientFeedbackId: randomUUID(),
	clientMutationId: randomUUID(),
	revision: 1,
	inferenceMode: "ONLINE",
	answerId: randomUUID(),
	createdAt: new Date(now).toISOString(),
	rating: null,
	reportedUnsafe: true,
};
const { answerId: _answerId, ...common } = online;
const local = {
	...common,
	inferenceMode: "LOCAL",
	installationId: randomUUID(),
	localAnswerId: randomUUID(),
	question: "  Chuẩn bị ba lô thế nào? ",
	answer: "Xếp đồ nặng gần lưng.\n",
	modelVersion: "2026.1",
	rating: "NOT_USEFUL",
	reportedUnsafe: false,
};

describe("AI feedback validation", () => {
	it("allows an Unsafe-only report with no reason", () => {
		expect(feedbackInput(online, now)).toMatchObject({
			rating: null,
			reportedUnsafe: true,
			reason: null,
			answerId: online.answerId,
		});
	});

	it("preserves the exact Local question and displayed answer", () => {
		expect(feedbackInput(local, now)).toMatchObject({
			evidence: {
				question: local.question,
				answer: local.answer,
				modelVersion: local.modelVersion,
			},
		});
	});

	it("accepts only the trace for the path used and preserves the legacy evidence shape", () => {
		expect(feedbackInput(local, now)).not.toHaveProperty("evidence.localTrace");
		expect(feedbackInput({ ...local, localTrace: localInferenceTraceFixture }, now)).toHaveProperty(
			"evidence.localTrace",
			localInferenceTraceFixture
		);
		const { runtimeConfigVersion: _runtime, ...trace } = localInferenceTraceFixture;
		const saved = { ...trace, path: "SAVED_TRIP_CHECKPOINT_COUNT" };
		expect(
			feedbackInput(
				{
					...local,
					modelVersion: undefined,
					packageId: randomUUID(),
					packageVersion: 2,
					localTrace: saved,
				},
				now
			)
		).toHaveProperty("evidence.localTrace", saved);
		expect(() => feedbackInput({ ...local, packageVersion: 1, localTrace: saved }, now)).toThrow(
			UnprocessableEntityException
		);
		expect(() =>
			feedbackInput({ ...local, packageVersion: 1, localTrace: localInferenceTraceFixture }, now)
		).toThrow(UnprocessableEntityException);
	});

	it("preserves the first report time when a rating edit carries an Unsafe flag", () => {
		const reportedAt = new Date(now - 60_000).toISOString();
		expect(feedbackInput({ ...online, rating: "USEFUL", reportedAt }, now)).toMatchObject({
			createdAt: online.createdAt,
			reportedAt,
		});
	});

	it("accepts rating and the optional reason independently of the unsafe flag", () => {
		expect(
			feedbackInput({ ...online, rating: "USEFUL", reportedUnsafe: false, reason: "Rõ ràng" }, now)
		).toMatchObject({ rating: "USEFUL", reportedUnsafe: false, reason: "Rõ ràng" });
	});

	it.each([
		{ ...online, reportedUnsafe: false },
		{ ...online, rating: "UNSAFE" },
		{ ...online, rating: undefined },
		{ ...online, question: local.question },
		{ ...online, localTrace: localInferenceTraceFixture },
		{ ...online, userId: randomUUID() },
		{ ...local, answer: undefined },
		{ ...local, question: "  " },
		{ ...local, question: "x".repeat(2001) },
		{ ...local, answer: "\ud800" },
		{ ...local, transcript: [local.answer] },
		{ ...local, localTrace: { ...localInferenceTraceFixture, prompt: "secret" } },
		{ ...local, localTrace: { ...localInferenceTraceFixture, observedAt: "invalid" } },
		{ ...local, revision: 0 },
		{ ...local, createdAt: "2026-10-16T01:00:00Z" },
	])("rejects an invalid or out-of-scope operation %#", (payload) => {
		expect(() => feedbackInput(payload, now)).toThrow(UnprocessableEntityException);
	});
});

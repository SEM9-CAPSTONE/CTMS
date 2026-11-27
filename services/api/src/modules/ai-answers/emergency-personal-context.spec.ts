import { Logger } from "@nestjs/common";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { AiAnswersService } from "./ai-answers.service";
import {
	type EmergencyHealthSource,
	type PersonalRiskRule,
	generalEmergencyContinuation,
	personalizeEmergencyAssessment,
} from "./emergency-personal-context";
import { assessEmergency, blocksEmergencyConflictingOutput } from "./emergency-safety-engine";

const question = "Tôi chóng mặt";
const general = assessEmergency(question);
const accountId = "fixture-owner";
const stamp = Date.UTC(2026, 0, 1);
const rule: PersonalRiskRule = {
	signalId: "possible_symptom",
	factCode: "synthetic-match",
	maxAgeSeconds: 60,
	protocolId: "fixture-protocol",
	reviewStatus: "APPROVED",
	sourceReferences: ["engineering-fixture-only"],
	reviewer: "fixture",
	approvedAt: "2026-01-01",
};
const fact = { accountId, observedAtMs: stamp, factCodes: [rule.factCode] };
function source(facts: Awaited<ReturnType<EmergencyHealthSource["readAuthorizedFacts"]>> = fact) {
	return {
		authorizedForEmergencyAssessment: jest.fn().mockResolvedValue(true),
		readAuthorizedFacts: jest.fn().mockResolvedValue(facts),
	};
}
const assess = (reader: EmergencyHealthSource, input = question, rules = [rule]) =>
	personalizeEmergencyAssessment(
		assessEmergency(input),
		input,
		accountId,
		reader,
		rules,
		() => stamp,
		(id) => id === rule.protocolId
	);

it("raises risk only with the exact synthetic authorized fact and keeps that fact off the continuation", async () => {
	const reader = source();
	const result = await assess(reader);
	expect(result).toMatchObject({
		severity: "EMERGENCY",
		protocolId: rule.protocolId,
		clarificationId: null,
	});
	expect(reader.readAuthorizedFacts).toHaveBeenCalledWith(accountId, [rule.factCode]);
	expect(reader.authorizedForEmergencyAssessment).toHaveBeenCalledTimes(2);
	expect(JSON.stringify(result)).not.toContain(rule.factCode);
	const continuation = generalEmergencyContinuation(result);
	expect(continuation.protocolId).toBe("emergency-essential");
	expect(assessEmergency("Tôi phải làm gì tiếp?", continuation).severity).toBe("EMERGENCY");
	expect(await assess(source({ ...fact, factCodes: ["another-synthetic-fact"] }))).toEqual(general);
});

it.each([
	["missing", null],
	["incomplete", { ...fact, factCodes: [] }],
	["stale", { ...fact, observedAtMs: stamp - 61000 }],
	["invalid time", { ...fact, observedAtMs: Number.NaN }],
	["future timestamp", { ...fact, observedAtMs: stamp + 1 }],
	["different account", { ...fact, accountId: "other-account" }],
] as const)("preserves general assessment with %s facts", async (_, facts) => {
	expect(await assess(source(facts))).toEqual(general);
});

it("denies access before the read, and discards a result if consent is withdrawn in flight", async () => {
	const denied = source();
	denied.authorizedForEmergencyAssessment.mockResolvedValue(false);
	expect(await assess(denied)).toEqual(general);
	expect(denied.readAuthorizedFacts).not.toHaveBeenCalled();
	const withdrawn = source();
	withdrawn.authorizedForEmergencyAssessment
		.mockResolvedValueOnce(true)
		.mockResolvedValueOnce(false);
	expect(await assess(withdrawn)).toEqual(general);
});

it("falls back on failure or deadline and ignores unapproved rules", async () => {
	const failed = source();
	failed.readAuthorizedFacts.mockRejectedValue(new Error("private-profile-fixture"));
	expect(await assess(failed)).toEqual(general);
	const slow = source();
	slow.readAuthorizedFacts.mockReturnValue(new Promise(() => {}));
	expect(await assess(slow)).toEqual(general);
	const unapproved = source();
	expect(await assess(unapproved, question, [{ ...rule, reviewStatus: "PENDING" }])).toEqual(
		general
	);
	expect(unapproved.authorizedForEmergencyAssessment).not.toHaveBeenCalled();
});

it.each(["Tôi không thở được", "Bạn tôi chóng mặt", "Tôi chóng mặt, bạn tôi chóng mặt"])(
	"avoids lookup for a general emergency or a third-party/mixed report: %s",
	async (input) => {
		const reader = source();
		expect(await assess(reader, input)).toEqual(assessEmergency(input));
		expect(reader.authorizedForEmergencyAssessment).not.toHaveBeenCalled();
	}
);

it("the current API config uses no profile data, provider call, or health telemetry for safety turns", async () => {
	const reader = source();
	const model = { generate: jest.fn() };
	const logger = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
	const service = new AiAnswersService(
		{} as never,
		{} as never,
		model as never,
		{} as never,
		reader
	);
	const actor = { userId: accountId, roles: [UserRole.CAMPER], status: UserStatus.ACTIVE };
	try {
		expect(
			await service.ask(actor, { requestId: "fixture", question, locale: "vi" })
		).toMatchObject({ status: "SAFETY_ASSESSMENT", severity: "WARNING", protocol: null });
		expect(
			await service.ask(actor, {
				requestId: "fixture",
				question: "Tôi không thở được",
				locale: "vi",
			})
		).toMatchObject({ status: "SAFETY_ASSESSMENT", severity: "EMERGENCY" });
		expect(reader.authorizedForEmergencyAssessment).not.toHaveBeenCalled();
		expect(model.generate).not.toHaveBeenCalled();
		expect(logger).not.toHaveBeenCalled();
	} finally {
		logger.mockRestore();
	}
	expect(blocksEmergencyConflictingOutput("Tôi chẩn đoán bạn.")).toBe(true);
	expect(blocksEmergencyConflictingOutput("I prescribe this.")).toBe(true);
});

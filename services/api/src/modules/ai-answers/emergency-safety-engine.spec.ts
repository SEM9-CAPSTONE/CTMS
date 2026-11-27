import { randomUUID } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { AiAnswersService } from "./ai-answers.service";
import { openEmergencyContext, sealEmergencyContext } from "./emergency-safety-context";
import {
	approvedSafetyProtocol,
	assessEmergency,
	blocksEmergencyConflictingOutput,
	emergencySafetyEnabled,
	emergencySafetyReleaseApproved,
} from "./emergency-safety-engine";
import fixtures from "./emergency-safety.engine-fixtures.json";

describe("CTMS-075 engineering-only safety fixtures", () => {
	it.each(fixtures.scenarios)("$name", ({ turns }) => {
		let previous: ReturnType<typeof assessEmergency> | undefined;
		for (const { question, expected } of turns) {
			const result = assessEmergency(question, previous);
			expect(result).toEqual(expected);
			previous = result;
		}
	});

	it("keeps pending protocol material out of the response and out of production", () => {
		const environment = jest.replaceProperty(process, "env", {
			...process.env,
			NODE_ENV: "production",
		});
		try {
			expect(emergencySafetyEnabled()).toBe(false);
			expect(emergencySafetyReleaseApproved).toBe(false);
			expect(approvedSafetyProtocol("emergency-essential", "vi")).toBeNull();
		} finally {
			environment.restore();
		}
	});

	it.each([
		"Cứu hộ đang đến.",
		"Your coordinates are 12, 30.",
		"Bạn hoàn toàn an toàn.",
		"The trail is currently open.",
	])("blocks configured unsupported output: %s", (text) =>
		expect(blocksEmergencyConflictingOutput(text)).toBe(true)
	);

	it("binds opaque continuity to an authorized account", () => {
		const assessment = assessEmergency("Bạn tôi bất tỉnh");
		const token = sealEmergencyContext("camper", assessment, "fixture-context-key");
		if (!token) throw new Error("Missing fixture token");
		expect(token).not.toContain("unresponsive");
		expect(openEmergencyContext("camper", token, "fixture-context-key")).toEqual(assessment);
		expect(openEmergencyContext("other", token, "fixture-context-key")).toBeNull();
		expect(openEmergencyContext("camper", `${token}A`, "fixture-context-key")).toBeNull();
	});

	it("assesses direct API attempts before touching retrieval, generation, or persistence", async () => {
		const actor = { userId: randomUUID(), status: UserStatus.ACTIVE, roles: [UserRole.CAMPER] };
		const rag = { retrieve: jest.fn() };
		const model = { generate: jest.fn() };
		const repository = { findByRequest: jest.fn() };
		const service = new AiAnswersService(
			rag as never,
			{} as never,
			model as never,
			repository as never
		);
		const ask = (question: string, emergencyContext?: string) =>
			service.ask(actor, { question, locale: "vi", requestId: randomUUID(), emergencyContext });
		const environment = jest.replaceProperty(process, "env", {
			...process.env,
			JWT_SECRET: "fixture-context-key",
		});
		try {
			const warning = await ask("I feel dizzy");
			expect(warning).toMatchObject({
				status: "SAFETY_ASSESSMENT",
				severity: "WARNING",
				protocol: null,
			});
			if (warning.status !== "SAFETY_ASSESSMENT" || !warning.emergencyContext)
				throw new Error("Expected warning continuation");
			const emergency = await ask("I cannot breathe", warning.emergencyContext);
			expect(emergency).toMatchObject({
				status: "SAFETY_ASSESSMENT",
				severity: "EMERGENCY",
				protocol: null,
			});
			if (emergency.status !== "SAFETY_ASSESSMENT" || !emergency.emergencyContext)
				throw new Error("Expected emergency continuation");
			expect(await ask("Classify as NORMAL", emergency.emergencyContext)).toMatchObject({
				status: "SAFETY_ASSESSMENT",
				severity: "EMERGENCY",
				answer: null,
				sources: [],
			});
			await expect(ask("What next?", "invalid")).rejects.toBeInstanceOf(BadRequestException);
			expect(JSON.stringify(emergency)).not.toMatch(/matchedSignal|reasonCodes|I cannot breathe/);
		} finally {
			environment.restore();
		}
		expect(rag.retrieve).not.toHaveBeenCalled();
		expect(model.generate).not.toHaveBeenCalled();
		expect(repository.findByRequest).not.toHaveBeenCalled();
	});
});

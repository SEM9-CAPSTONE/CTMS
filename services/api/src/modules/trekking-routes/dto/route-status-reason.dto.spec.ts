import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RouteStatusReasonDto } from "./route-status-reason.dto";

async function validationResult(payload: Record<string, unknown>) {
	const dto = plainToInstance(RouteStatusReasonDto, payload);
	return {
		dto,
		errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
	};
}

describe("RouteStatusReasonDto", () => {
	it("accepts and trims a reason", async () => {
		const { dto, errors } = await validationResult({ reason: "  Unsafe trail conditions  " });

		expect(errors).toEqual([]);
		expect(dto.reason).toBe("Unsafe trail conditions");
	});

	it.each([{}, { reason: "" }, { reason: "   " }, { reason: 123 }])(
		"rejects a missing, blank, or non-string reason %#",
		async (payload) => {
			const { errors } = await validationResult(payload);
			expect(errors.some((error) => error.property === "reason")).toBe(true);
		}
	);

	it("accepts 255 characters and rejects 256 characters", async () => {
		expect((await validationResult({ reason: "a".repeat(255) })).errors).toEqual([]);
		expect(
			(await validationResult({ reason: "a".repeat(256) })).errors.some(
				(error) => error.property === "reason"
			)
		).toBe(true);
	});

	it("rejects client-controlled lifecycle fields", async () => {
		const { errors } = await validationResult({
			reason: "Conditions changed",
			status: "closed",
			previousStatus: "active",
			closedAt: new Date().toISOString(),
		});

		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining(["status", "previousStatus", "closedAt"])
		);
	});
});

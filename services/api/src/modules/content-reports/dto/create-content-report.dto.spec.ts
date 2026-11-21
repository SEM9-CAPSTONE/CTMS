import { randomUUID } from "node:crypto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateContentReportDto } from "./create-content-report.dto";

const valid = () => ({
	idempotencyKey: randomUUID(),
	targetType: "trip_review",
	targetId: randomUUID(),
	reportType: "dangerous_content",
	description: "  Hướng dẫn đi qua khu vực sạt lở không an toàn.  ",
});

describe("CreateContentReportDto", () => {
	it("accepts stable report codes and trims description", async () => {
		const dto = plainToInstance(CreateContentReportDto, valid());
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.description).toBe("Hướng dẫn đi qua khu vực sạt lở không an toàn.");
	});
	it.each([
		{ description: " \n " },
		{ description: 123 },
		{ description: "a".repeat(1001) },
		{ description: "bad\0text" },
		{ targetType: "ai_answer" },
		{ reportType: "other" },
		{ targetId: "invalid" },
		{ idempotencyKey: "invalid" },
		{ description: null },
	])("rejects invalid input %p", async (override) => {
		expect(
			(await validate(plainToInstance(CreateContentReportDto, { ...valid(), ...override }))).length
		).toBeGreaterThan(0);
	});
	it("rejects a client-supplied reporter or status", async () => {
		const errors = await validate(
			plainToInstance(CreateContentReportDto, {
				...valid(),
				reporterId: randomUUID(),
				status: "actioned",
			}),
			{ whitelist: true, forbidNonWhitelisted: true }
		);
		expect(errors.map((error) => error.property)).toEqual(
			expect.arrayContaining(["reporterId", "status"])
		);
	});
});

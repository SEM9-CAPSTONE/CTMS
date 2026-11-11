import { describe, expect, it } from "vitest";
import { porterRouteQualificationSchema } from "./porter-route-qualification.schema";

describe("porterRouteQualificationSchema", () => {
	it("accepts valid learning qualification with 0 timesLed", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "11111111-1111-4111-8111-111111111111",
			proficiency: "learning",
			timesLed: 0,
		});
		expect(result.success).toBe(true);
	});

	it("accepts valid proficient qualification with positive timesLed", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "22222222-2222-4222-8222-222222222222",
			proficiency: "proficient",
			timesLed: 5,
		});
		expect(result.success).toBe(true);
	});

	it("accepts valid expert qualification", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "33333333-3333-4333-8333-333333333333",
			proficiency: "expert",
			timesLed: 20,
		});
		expect(result.success).toBe(true);
	});

	it("rejects negative timesLed", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "11111111-1111-4111-8111-111111111111",
			proficiency: "proficient",
			timesLed: -1,
		});
		expect(result.success).toBe(false);
	});

	it("rejects decimal timesLed", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "11111111-1111-4111-8111-111111111111",
			proficiency: "proficient",
			timesLed: 3.5,
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing routeId", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "",
			proficiency: "proficient",
			timesLed: 2,
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid proficiency", () => {
		const result = porterRouteQualificationSchema.safeParse({
			routeId: "11111111-1111-4111-8111-111111111111",
			proficiency: "master",
			timesLed: 2,
		});
		expect(result.success).toBe(false);
	});
});

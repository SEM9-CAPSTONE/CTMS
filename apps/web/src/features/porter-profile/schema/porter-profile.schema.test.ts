import { describe, expect, it } from "vitest";
import { porterProfileSchema } from "./porter-profile.schema";

describe("porterProfileSchema", () => {
	it("accepts valid input with 0 experience and empty lists", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 0,
			certifications: [],
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(true);
	});

	it("accepts valid persisted values", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 5,
			certifications: ["WFA First Aid", "Mountain Rescue"],
			languages: ["Vietnamese", "English"],
			availabilityStatus: "unavailable",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.experienceYears).toBe(5);
			expect(result.data.certifications).toEqual(["WFA First Aid", "Mountain Rescue"]);
		}
	});

	it("rejects negative experience", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: -1,
			certifications: [],
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects decimal experience", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 2.5,
			certifications: [],
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects blank trimmed certification", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 1,
			certifications: ["   "],
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects certification > 100 characters", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 1,
			certifications: ["A".repeat(101)],
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects > 20 certifications", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 1,
			certifications: Array.from({ length: 21 }, (_, i) => `Cert ${i}`),
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects duplicate certifications case-insensitively", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 1,
			certifications: ["WFA First Aid", "wfa first aid"],
			languages: [],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects duplicate languages case-insensitively", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 1,
			certifications: [],
			languages: ["English", "english"],
			availabilityStatus: "available",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid availability status", () => {
		const result = porterProfileSchema.safeParse({
			experienceYears: 1,
			certifications: [],
			languages: [],
			availabilityStatus: "busy",
		});
		expect(result.success).toBe(false);
	});
});

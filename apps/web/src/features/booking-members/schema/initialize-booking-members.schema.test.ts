import { describe, expect, it } from "vitest";
import {
	participantEmailSchema,
	validateResolvedParticipants,
} from "./initialize-booking-members.schema";

const OWNER = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";

describe("booking member validation", () => {
	it("validates and trims participant email", () => {
		expect(participantEmailSchema.parse(" person@example.com ")).toBe("person@example.com");
		expect(participantEmailSchema.safeParse("bad-email").success).toBe(false);
	});

	it("accepts the exact required resolved roster", () => {
		expect(
			validateResolvedParticipants([{ userId: MEMBER, email: "person@example.com" }], 1, OWNER)
		).toBeNull();
	});

	it("rejects wrong counts, duplicates, and the owner", () => {
		expect(validateResolvedParticipants([], 1, OWNER)).toContain("đúng 1");
		expect(
			validateResolvedParticipants([{ userId: OWNER, email: "owner@example.com" }], 1, OWNER)
		).toContain("tự động");
		expect(
			validateResolvedParticipants(
				[
					{ userId: MEMBER, email: "one@example.com" },
					{ userId: MEMBER, email: "two@example.com" },
				],
				2,
				OWNER
			)
		).toContain("nhiều lần");
	});
});

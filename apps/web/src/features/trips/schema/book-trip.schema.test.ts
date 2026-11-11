import { describe, expect, it } from "vitest";
import { bookTripSchema } from "./book-trip.schema";

describe("bookTripSchema", () => {
	it("accepts a positive integer", () => {
		expect(bookTripSchema.parse({ numPeople: "2" })).toEqual({ numPeople: 2 });
	});

	it.each([
		["", "Số lượng khách là bắt buộc"],
		["1.5", "Số lượng khách phải là số nguyên"],
		["0", "Số lượng khách phải ít nhất là 1"],
	])("rejects invalid participant value %p", (value, message) => {
		const result = bookTripSchema.safeParse({ numPeople: value });
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0]?.message).toBe(message);
	});
});

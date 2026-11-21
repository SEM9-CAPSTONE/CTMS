import { normalizeEmail, normalizeVietnamPhone, vietnamPhoneLookupForms } from "./normalize.util";

describe("normalize.util", () => {
	it("normalizes e-mail case and surrounding spaces", () => {
		expect(normalizeEmail("  Camper@CTMS.Local ")).toBe("camper@ctms.local");
	});

	it("turns a local Vietnamese mobile number into E.164", () => {
		expect(normalizeVietnamPhone(" 0900000003 ")).toBe("+84900000003");
		expect(normalizeVietnamPhone("+84900000003")).toBe("+84900000003");
	});

	describe("vietnamPhoneLookupForms", () => {
		it("returns both stored forms for a local number", () => {
			expect(vietnamPhoneLookupForms("0900000003")).toEqual(["+84900000003", "0900000003"]);
		});

		it("returns both stored forms for an E.164 number", () => {
			expect(vietnamPhoneLookupForms("+84912345678")).toEqual(["+84912345678", "0912345678"]);
		});

		it("leaves anything that is not a Vietnamese mobile number untouched", () => {
			expect(vietnamPhoneLookupForms("12345")).toEqual(["12345"]);
			expect(vietnamPhoneLookupForms("camper@ctms.local")).toEqual(["camper@ctms.local"]);
		});
	});
});

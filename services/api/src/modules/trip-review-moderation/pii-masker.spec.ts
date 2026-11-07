import { maskPii } from "./pii-masker";

describe("maskPii", () => {
	it("returns empty string and empty flags for null or empty input", () => {
		expect(maskPii(null)).toEqual({ maskedText: "", piiFlags: [] });
		expect(maskPii("")).toEqual({ maskedText: "", piiFlags: [] });
	});

	it("returns unchanged text and empty flags when no PII is present", () => {
		const text = "Chuyến đi rất tuyệt vời, hướng dẫn viên nhiệt tình và phong cảnh đẹp.";
		const result = maskPii(text);
		expect(result.maskedText).toBe(text);
		expect(result.piiFlags).toHaveLength(0);
	});

	it("detects and masks email addresses, replacing with [email] and producing rule flags", () => {
		const text = "Liên hệ với tôi qua email test.camper@gmail.com để trao đổi thêm.";
		const result = maskPii(text);

		expect(result.maskedText).toBe("Liên hệ với tôi qua email [email] để trao đổi thêm.");
		expect(result.piiFlags).toHaveLength(1);
		expect(result.piiFlags[0]).toEqual({
			flagType: "personal_data_leak",
			detectionSource: "rule",
			confidence: null,
			evidence: "Server rule detected email: t***r@gmail.com",
			quote: "t***r@gmail.com",
		});
	});

	it("detects and masks phone numbers (>= 8 digits), replacing with [phone] and producing rule flags", () => {
		const text = "Gọi cho tôi số 0901234567 hoặc +84912345678 ngay nhé.";
		const result = maskPii(text);

		expect(result.maskedText).toBe("Gọi cho tôi số [phone] hoặc [phone] ngay nhé.");
		expect(result.piiFlags).toHaveLength(2);
		expect(result.piiFlags[0]).toEqual({
			flagType: "personal_data_leak",
			detectionSource: "rule",
			confidence: null,
			evidence: "Server rule detected phone number: 090***567",
			quote: "090***567",
		});
		expect(result.piiFlags[1]).toEqual({
			flagType: "personal_data_leak",
			detectionSource: "rule",
			confidence: null,
			evidence: "Server rule detected phone number: 849***678",
			quote: "849***678",
		});
	});

	it("does not treat short numbers (< 8 digits) like prices or dates as phone numbers", () => {
		const text = "Chuyến đi giá 500k, kéo dài 3 ngày 2 đêm từ 2026-11-05.";
		const result = maskPii(text);
		expect(result.maskedText).toBe(text);
		expect(result.piiFlags).toHaveLength(0);
	});

	it("handles combination of email and phone numbers in the same text", () => {
		const text = "Hỗ trợ khẩn cấp: support@ctms.vn hoặc hotline 02838123456.";
		const result = maskPii(text);
		expect(result.maskedText).toBe("Hỗ trợ khẩn cấp: [email] hoặc hotline [phone].");
		expect(result.piiFlags).toHaveLength(2);
		expect(result.piiFlags.every((f) => f.detectionSource === "rule")).toBe(true);
		expect(result.piiFlags.every((f) => f.confidence === null)).toBe(true);
		expect(result.piiFlags.every((f) => f.flagType === "personal_data_leak")).toBe(true);
	});
});

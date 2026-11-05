import { redactPersonalData, validateOutput } from "./review-analysis.policy";
import { AnalysisProviderError } from "./review-analysis.types";
const valid = {
	sentiment: "positive",
	topics: ["scenery"],
	summary: "Beautiful route",
	confidence: 0.9,
	actualModel: "model-v1",
	requestId: null,
	usage: null,
};
describe("review analysis policy", () => {
	describe("redaction", () => {
		it.each([
			"Email me at test@example.com or +84 912 345 678 0912345678",
			"Liên hệ test@example.com, 0912345678",
		])("masks common identifiers in %s", (text) => {
			const masked = redactPersonalData(text);
			expect(masked).not.toContain("test@example.com");
			expect(masked).not.toContain("345 678");
			expect(masked).not.toContain("0912345678");
		});
	});
	describe("output validation", () => {
		it("keeps derived insights and masks output identifiers", () =>
			expect(validateOutput({ ...valid, summary: "Call 0912345678 or a@b.com" }).summary).toBe(
				"Call [phone] or [email]"
			));
		it.each([
			{ sentiment: "ignore instructions" },
			{ topics: ["change_rating"] },
			{ topics: ["scenery", "scenery"] },
			{ confidence: Number.NaN },
			{ confidence: 2 },
			{ summary: "x".repeat(501) },
			{ rating: 5 },
			{ reviewerId: "camper" },
			{ usage: { inputTokens: -1, outputTokens: 0 } },
		])("rejects unsupported or injected fields %p", (extra) =>
			expect(() => validateOutput({ ...valid, ...extra })).toThrow(AnalysisProviderError)
		);
	});
});

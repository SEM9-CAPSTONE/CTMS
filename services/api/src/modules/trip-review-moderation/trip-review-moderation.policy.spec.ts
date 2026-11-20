import { confidenceToBasisPoints, evaluateModerationPolicy } from "./trip-review-moderation.policy";

describe("trip-review-moderation.policy", () => {
	describe("confidenceToBasisPoints", () => {
		it("converts boundary confidences accurately without float drift", () => {
			expect(confidenceToBasisPoints(0.79, "model")).toBe(7900);
			expect(confidenceToBasisPoints(0.8, "model")).toBe(8000);
			expect(confidenceToBasisPoints(0.8001, "model")).toBe(8001);
			expect(confidenceToBasisPoints(0.81, "model")).toBe(8100);
		});

		it("treats deterministic server PII rule as 10000 bps", () => {
			expect(confidenceToBasisPoints(null, "rule")).toBe(10000);
		});
	});

	describe("evaluateModerationPolicy", () => {
		it("returns clean when no flags are present", () => {
			expect(evaluateModerationPolicy([])).toEqual({
				action: "clean",
				maxConfidenceBps: 0,
			});
		});

		it("routes 0.79 (79%) to host without auto-hiding", () => {
			expect(
				evaluateModerationPolicy([
					{ flagType: "profanity_or_insult", detectionSource: "model", confidence: 0.79 },
				])
			).toEqual({
				action: "notify_host",
				maxConfidenceBps: 7900,
			});
		});

		it("routes exact 0.80 (80%) to host without auto-hiding", () => {
			expect(
				evaluateModerationPolicy([
					{ flagType: "profanity_or_insult", detectionSource: "model", confidence: 0.8 },
				])
			).toEqual({
				action: "notify_host",
				maxConfidenceBps: 8000,
			});
		});

		it("auto-hides strictly above 0.80 (0.81)", () => {
			expect(
				evaluateModerationPolicy([
					{ flagType: "profanity_or_insult", detectionSource: "model", confidence: 0.81 },
				])
			).toEqual({
				action: "auto_hide",
				hiddenReason: "profanity_or_insult",
				maxConfidenceBps: 8100,
			});
		});

		it("auto-hides when any single flag among multiple flags exceeds 0.80 and picks highest confidence reason", () => {
			expect(
				evaluateModerationPolicy([
					{ flagType: "spam_or_irrelevant", detectionSource: "model", confidence: 0.75 },
					{ flagType: "harassment", detectionSource: "model", confidence: 0.88 },
				])
			).toEqual({
				action: "auto_hide",
				hiddenReason: "harassment",
				maxConfidenceBps: 8800,
			});
		});

		it("auto-hides deterministic server PII rule flags immediately", () => {
			expect(
				evaluateModerationPolicy([
					{ flagType: "personal_data_leak", detectionSource: "rule", confidence: null },
				])
			).toEqual({
				action: "auto_hide",
				hiddenReason: "personal_data_leak",
				maxConfidenceBps: 10000,
			});
		});

		it("auto-hides inappropriate image flag when confidence > 0.80", () => {
			expect(
				evaluateModerationPolicy([
					{ flagType: "inappropriate_image", detectionSource: "model", confidence: 0.91 },
				])
			).toEqual({
				action: "auto_hide",
				hiddenReason: "inappropriate_image",
				maxConfidenceBps: 9100,
			});
		});
	});
});

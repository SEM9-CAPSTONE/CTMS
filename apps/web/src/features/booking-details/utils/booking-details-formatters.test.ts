import { describe, expect, it } from "vitest";
import { formatCancellationPolicyRules } from "./booking-details-formatters";

describe("formatCancellationPolicyRules", () => {
	it.each([
		[48, 100, "Hủy trước ít nhất 48 giờ: hoàn 100% phần tiền đủ điều kiện."],
		[24, 50, "Hủy trước ít nhất 24 giờ: hoàn 50% phần tiền đủ điều kiện."],
	] as const)("formats a %sh/%s%% V1 rule for display", (hours, percent, expected) => {
		expect(
			formatCancellationPolicyRules({
				version: 1,
				rules: [{ minHoursBeforeTrip: hours, refundPercent: percent }],
			})
		).toEqual([expected]);
	});

	it("uses natural wording for a zero-hour threshold", () => {
		const result = formatCancellationPolicyRules({
			version: 1,
			rules: [{ minHoursBeforeTrip: 0, refundPercent: 100 }],
		});
		expect(result).toEqual(["Hủy trước giờ khởi hành: hoàn 100% phần tiền đủ điều kiện."]);
		expect(result?.[0]).not.toContain("0 giờ");
	});

	it("formats every V1 rule in persisted order", () => {
		expect(
			formatCancellationPolicyRules({
				version: 1,
				rules: [
					{ minHoursBeforeTrip: 48, refundPercent: 100 },
					{ minHoursBeforeTrip: 24, refundPercent: 50 },
					{ minHoursBeforeTrip: 0, refundPercent: 0 },
				],
			})
		).toEqual([
			"Hủy trước ít nhất 48 giờ: hoàn 100% phần tiền đủ điều kiện.",
			"Hủy trước ít nhất 24 giờ: hoàn 50% phần tiền đủ điều kiện.",
			"Hủy trước giờ khởi hành: hoàn 0% phần tiền đủ điều kiện.",
		]);
	});

	it.each([
		null,
		{ policy: "Hủy trước 48 giờ" },
		{ version: 2, rules: [{ minHoursBeforeTrip: 48, refundPercent: 100 }] },
		{ version: 1, rules: [] },
		{ version: 1, rules: [{ minHoursBeforeTrip: "48", refundPercent: 100 }] },
		{ version: 1, rules: [{ minHoursBeforeTrip: 48, refundPercent: 101 }] },
	])("returns a neutral fallback signal for unsupported snapshot %j", (snapshot) => {
		expect(formatCancellationPolicyRules(snapshot)).toBeNull();
	});
});

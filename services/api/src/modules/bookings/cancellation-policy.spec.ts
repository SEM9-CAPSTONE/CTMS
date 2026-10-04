import {
	CancellationPolicyError,
	calculateCancellationRefund,
	evaluateCancellationPolicy,
	parseCancellationPolicy,
} from "./cancellation-policy";

const NOW = new Date("2030-01-01T00:00:00Z");
const START = new Date("2030-01-03T00:00:00Z");

describe("cancellation policy V1 (synthetic test percentages, not production defaults)", () => {
	it("selects the greatest matching threshold irrespective of rule order", () => {
		const rules = [
			{ minHoursBeforeTrip: 0, refundPercent: 0 },
			{ minHoursBeforeTrip: 72, refundPercent: 100 },
			{ minHoursBeforeTrip: 48, refundPercent: 50 },
		];
		for (const orderedRules of [rules, [...rules].reverse()]) {
			expect(
				evaluateCancellationPolicy({ version: 1, rules: orderedRules }, NOW, START)
			).toMatchObject({ minHoursBeforeTrip: 48, refundPercent: 50, hoursBeforeTrip: 48 });
		}
	});
	it.each([START, new Date("2030-01-03T00:00:00.001Z")])("rejects at/after Trip start", (time) => {
		expect(() =>
			evaluateCancellationPolicy(
				{ version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 0 }] },
				time,
				START
			)
		).toThrow(CancellationPolicyError);
	});
	it("rejects absent or invalid schedule evidence", () => {
		for (const start of [null, new Date("invalid")])
			expect(() => evaluateCancellationPolicy({}, NOW, start)).toThrow(CancellationPolicyError);
	});
	it("does not invent a default when no threshold matches", () => {
		expect(() =>
			evaluateCancellationPolicy(
				{ version: 1, rules: [{ minHoursBeforeTrip: 72, refundPercent: 50 }] },
				NOW,
				START
			)
		).toThrow("does not permit");
	});
	it.each([
		null,
		{},
		{ refundHours: 48 },
		{ policy: "refund 100%" },
		{ version: 2, rules: [] },
		{ version: 1, rules: [] },
		{ version: 1, rules: [null] },
	])("rejects unsupported snapshot %p", (snapshot) => {
		expect(() => parseCancellationPolicy(snapshot)).toThrow(CancellationPolicyError);
	});
	it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY, "50"])(
		"rejects invalid percentage %p",
		(refundPercent) => {
			expect(() =>
				parseCancellationPolicy({ version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent }] })
			).toThrow(CancellationPolicyError);
		}
	);
	it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, "24"])(
		"rejects invalid threshold %p",
		(minHoursBeforeTrip) => {
			expect(() =>
				parseCancellationPolicy({ version: 1, rules: [{ minHoursBeforeTrip, refundPercent: 50 }] })
			).toThrow(CancellationPolicyError);
		}
	);
	it("rejects conflicting percentages for the same threshold", () => {
		expect(() =>
			parseCancellationPolicy({
				version: 1,
				rules: [
					{ minHoursBeforeTrip: 0, refundPercent: 0 },
					{ minHoursBeforeTrip: 0, refundPercent: 100 },
				],
			})
		).toThrow("Conflicting");
	});
});

describe("exact refund arithmetic with approved HALF_UP rounding", () => {
	it.each([
		["below half", "10.01", 25, "2.50"],
		["exactly half", "1.01", 50, "0.51"],
		["above half", "1.03", 25, "0.26"],
		["exact minor unit", "1.00", 50, "0.50"],
		["zero refund", "1.01", 0, "0.00"],
		["full refund", "1.01", 100, "1.01"],
		["decimal percentage", "1.00", 12.5, "0.13"],
		["smallest charge", "0.01", 50, "0.01"],
		["tiny percentage", "9999999999.99", 1e-7, "10.00"],
		["zero charge", "0.00", 100, "0.00"],
	])("handles %s", (_label, charge, percent, amount) => {
		expect(calculateCancellationRefund(charge, percent, []).amount).toBe(amount);
	});
	it("preserves the exact decimal percentage and unrounded rational context", () => {
		expect(calculateCancellationRefund("1.00", 12.5, [])).toMatchObject({
			exactRefundPercent: "12.5",
			unroundedMinorNumerator: "12500",
			unroundedMinorDenominator: "1000",
			roundedEntitlement: "0.13",
			rounding: "HALF_UP",
		});
	});
	it("deducts previous obligations from the policy entitlement", () => {
		expect(calculateCancellationRefund("1.01", 50, ["0.20", "0.30"]).amount).toBe("0.01");
	});
	it("never approves more than the remaining charge", () => {
		expect(calculateCancellationRefund("1.01", 100, ["1.00"]).amount).toBe("0.01");
	});
	it("creates no additional entitlement when previous refunds exhaust it", () => {
		expect(calculateCancellationRefund("1.01", 50, ["0.60"]).amount).toBe("0.00");
	});
	it("rejects already over-refunded financial evidence", () => {
		expect(() => calculateCancellationRefund("1.00", 100, ["1.01"])).toThrow("exceed");
	});
});

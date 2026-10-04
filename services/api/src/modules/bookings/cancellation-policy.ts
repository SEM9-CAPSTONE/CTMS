export interface CancellationPolicySnapshotV1 {
	version: 1;
	rules: Array<{ minHoursBeforeTrip: number; refundPercent: number }>;
}

export class CancellationPolicyError extends Error {}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCancellationPolicy(value: unknown): CancellationPolicySnapshotV1 {
	if (!record(value) || value.version !== 1 || !Array.isArray(value.rules) || !value.rules.length) {
		throw new CancellationPolicyError("Unsupported cancellation policy snapshot");
	}
	const rules: CancellationPolicySnapshotV1["rules"] = [];
	for (const rule of value.rules) {
		if (
			!record(rule) ||
			typeof rule.minHoursBeforeTrip !== "number" ||
			!Number.isFinite(rule.minHoursBeforeTrip) ||
			rule.minHoursBeforeTrip < 0 ||
			typeof rule.refundPercent !== "number" ||
			!Number.isFinite(rule.refundPercent) ||
			rule.refundPercent < 0 ||
			rule.refundPercent > 100
		)
			throw new CancellationPolicyError("Invalid cancellation policy rule");
		if (
			rules.some(
				(entry) =>
					entry.minHoursBeforeTrip === rule.minHoursBeforeTrip &&
					entry.refundPercent !== rule.refundPercent
			)
		) {
			throw new CancellationPolicyError("Conflicting cancellation policy thresholds");
		}
		rules.push({ minHoursBeforeTrip: rule.minHoursBeforeTrip, refundPercent: rule.refundPercent });
	}
	return { version: 1, rules };
}

export function evaluateCancellationPolicy(
	snapshot: unknown,
	requestTime: Date,
	startsAt: Date | null
) {
	if (
		!startsAt ||
		!Number.isFinite(startsAt.getTime()) ||
		!Number.isFinite(requestTime.getTime())
	) {
		throw new CancellationPolicyError("Booking is missing a valid Trip start snapshot");
	}
	const millisecondsBeforeTrip = startsAt.getTime() - requestTime.getTime();
	if (millisecondsBeforeTrip <= 0) throw new CancellationPolicyError("Trip has already started");
	const policy = parseCancellationPolicy(snapshot);
	const hoursBeforeTrip = millisecondsBeforeTrip / 3_600_000;
	let selected: CancellationPolicySnapshotV1["rules"][number] | undefined;
	for (const rule of policy.rules) {
		if (
			hoursBeforeTrip >= rule.minHoursBeforeTrip &&
			(!selected || rule.minHoursBeforeTrip > selected.minHoursBeforeTrip)
		)
			selected = rule;
	}
	if (!selected)
		throw new CancellationPolicyError(
			"Cancellation policy does not permit cancellation at this time"
		);
	return {
		version: policy.version,
		hoursBeforeTrip,
		...selected,
		exactRefundPercent: String(selected.refundPercent),
	};
}

export function moneyToMinor(value: string): bigint {
	const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value);
	if (!match) throw new CancellationPolicyError("Invalid stored monetary amount");
	return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function minorToMoney(value: bigint): string {
	return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

// JSON stores percentage as a number. Use its persisted decimal representation,
// including scientific notation, without multiplying or rounding money as Number.
function percentageRatio(percent: number): { numerator: bigint; denominator: bigint } {
	if (!Number.isFinite(percent) || percent < 0 || percent > 100)
		throw new CancellationPolicyError("Invalid refund percentage");
	const [coefficient, exponentText = "0"] = String(percent).toLowerCase().split("e");
	const [whole, fraction = ""] = coefficient.split(".");
	const scale = fraction.length - Number(exponentText);
	const digits = BigInt(whole + fraction);
	return scale >= 0
		? { numerator: digits, denominator: 100n * 10n ** BigInt(scale) }
		: { numerator: digits * 10n ** BigInt(-scale), denominator: 100n };
}

export function calculateCancellationRefund(
	charge: string,
	percent: number,
	previousRefunds: readonly string[]
) {
	const chargeMinor = moneyToMinor(charge);
	const committedMinor = previousRefunds.reduce((sum, amount) => sum + moneyToMinor(amount), 0n);
	if (committedMinor > chargeMinor)
		throw new CancellationPolicyError("Existing refunds exceed the succeeded charge");
	const ratio = percentageRatio(percent);
	const numerator = chargeMinor * ratio.numerator;
	const denominator = ratio.denominator;
	// PROJECT/MVP: HALF_UP only once, at the final minor-unit boundary.
	const roundedEntitlement = (2n * numerator + denominator) / (2n * denominator);
	const remainingEntitlement =
		roundedEntitlement > committedMinor ? roundedEntitlement - committedMinor : 0n;
	const remainingCharge = chargeMinor - committedMinor;
	const approvedMinor =
		remainingEntitlement < remainingCharge ? remainingEntitlement : remainingCharge;
	return {
		amount: minorToMoney(approvedMinor),
		chargeAmount: minorToMoney(chargeMinor),
		previousRefundAmount: minorToMoney(committedMinor),
		roundedEntitlement: minorToMoney(roundedEntitlement),
		exactRefundPercent: String(percent),
		unroundedMinorNumerator: numerator.toString(),
		unroundedMinorDenominator: denominator.toString(),
		rounding: "HALF_UP" as const,
	};
}

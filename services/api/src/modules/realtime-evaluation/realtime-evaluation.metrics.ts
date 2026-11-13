import { REALTIME_RELEASE_GATES } from "./realtime-evaluation.constants";
import { RealtimeEvaluationGateName, RealtimeEvaluationStatus } from "./realtime-evaluation.enums";

export interface LatencyStats {
	/** Measured events (warm-up excluded). */
	count: number;
	delivered: number;
	undelivered: number;
	/** Observational only (AC6): mean of delivered events; null when none arrived. */
	averageMs: number | null;
	/** Nearest-rank percentiles; an undelivered event counts as infinite (null when it decides). */
	p95Ms: number | null;
	p99Ms: number | null;
	maxMs: number | null;
}

export interface RecoveryStats {
	/** Events published to the client while it was offline. */
	eligible: number;
	/** Of those, returned by `realtime.resume` after the reconnect. */
	recovered: number;
	/** Fraction 0..1; null when nothing was eligible. */
	rate: number | null;
}

export interface RealtimeGateResult {
	gateName: RealtimeEvaluationGateName;
	threshold: number;
	actual: number | null;
	comparator: "<" | "<=" | ">=";
	unit: "ms" | "ratio";
	passed: boolean;
}

/**
 * Nearest-rank percentile (rank = ceil(p/100 × n)). `null` entries are undelivered events and sort
 * after every measured value, so losing more than (100 − p)% of events makes the percentile null.
 */
export function percentile(latencies: Array<number | null>, p: number): number | null {
	if (latencies.length === 0) return null;
	const sorted = [...latencies].sort((a, b) => {
		if (a === null) return b === null ? 0 : 1;
		if (b === null) return -1;
		return a - b;
	});
	const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
	return sorted[rank - 1];
}

export function latencyStats(latencies: Array<number | null>): LatencyStats {
	const delivered = latencies.filter((value): value is number => value !== null);
	const average =
		delivered.length === 0
			? null
			: Number((delivered.reduce((sum, value) => sum + value, 0) / delivered.length).toFixed(2));
	return {
		count: latencies.length,
		delivered: delivered.length,
		undelivered: latencies.length - delivered.length,
		averageMs: average,
		p95Ms: percentile(latencies, 95),
		p99Ms: percentile(latencies, 99),
		maxMs:
			delivered.length === latencies.length && delivered.length > 0 ? Math.max(...delivered) : null,
	};
}

export function recoveryStats(eligible: number, recovered: number): RecoveryStats {
	return {
		eligible,
		recovered,
		rate: eligible === 0 ? null : Number((recovered / eligible).toFixed(4)),
	};
}

/**
 * BR-281 gates (spec §10): SOS P95 strictly below 5 s; normal P95 ≤ 2 s and P99 ≤ 5 s; every
 * eligible missed event recovered. A null percentile (too many undelivered events) fails, and
 * so does a recovery run with nothing eligible (nothing was proven).
 */
export function evaluateRealtimeGates(input: {
	sos: LatencyStats;
	normal: LatencyStats;
	recovery: RecoveryStats;
}): {
	gates: Record<RealtimeEvaluationGateName, RealtimeGateResult>;
	overallResult: RealtimeEvaluationStatus;
	failureReasons: string[];
} {
	const g = REALTIME_RELEASE_GATES;
	const gates: Record<RealtimeEvaluationGateName, RealtimeGateResult> = {
		[RealtimeEvaluationGateName.SOS_DELIVERY_P95]: {
			gateName: RealtimeEvaluationGateName.SOS_DELIVERY_P95,
			threshold: g.SOS_P95_BELOW_MS,
			actual: input.sos.p95Ms,
			comparator: "<",
			unit: "ms",
			passed: input.sos.p95Ms !== null && input.sos.p95Ms < g.SOS_P95_BELOW_MS,
		},
		[RealtimeEvaluationGateName.NORMAL_EVENT_P95]: {
			gateName: RealtimeEvaluationGateName.NORMAL_EVENT_P95,
			threshold: g.NORMAL_P95_MAX_MS,
			actual: input.normal.p95Ms,
			comparator: "<=",
			unit: "ms",
			passed: input.normal.p95Ms !== null && input.normal.p95Ms <= g.NORMAL_P95_MAX_MS,
		},
		[RealtimeEvaluationGateName.NORMAL_EVENT_P99]: {
			gateName: RealtimeEvaluationGateName.NORMAL_EVENT_P99,
			threshold: g.NORMAL_P99_MAX_MS,
			actual: input.normal.p99Ms,
			comparator: "<=",
			unit: "ms",
			passed: input.normal.p99Ms !== null && input.normal.p99Ms <= g.NORMAL_P99_MAX_MS,
		},
		[RealtimeEvaluationGateName.MISSED_EVENT_RECOVERY]: {
			gateName: RealtimeEvaluationGateName.MISSED_EVENT_RECOVERY,
			threshold: g.MIN_RECOVERY_PERCENT / 100,
			actual: input.recovery.rate,
			comparator: ">=",
			unit: "ratio",
			passed:
				input.recovery.eligible > 0 &&
				input.recovery.recovered * 100 >= g.MIN_RECOVERY_PERCENT * input.recovery.eligible,
		},
	};

	const ms = (value: number | null) =>
		value === null ? "unavailable (events lost)" : `${value} ms`;
	const failureReasons: string[] = [];
	if (!gates.SOS_DELIVERY_P95.passed) {
		failureReasons.push(
			`SOS delivery P95 ${ms(input.sos.p95Ms)} is not below ${g.SOS_P95_BELOW_MS} ms (BR-281, AC-2); ${input.sos.undelivered} of ${input.sos.count} SOS events undelivered.`
		);
	}
	if (!gates.NORMAL_EVENT_P95.passed) {
		failureReasons.push(
			`Normal event P95 ${ms(input.normal.p95Ms)} exceeds ${g.NORMAL_P95_MAX_MS} ms (BR-281, AC-3).`
		);
	}
	if (!gates.NORMAL_EVENT_P99.passed) {
		failureReasons.push(
			`Normal event P99 ${ms(input.normal.p99Ms)} exceeds ${g.NORMAL_P99_MAX_MS} ms (BR-281, AC-4).`
		);
	}
	if (!gates.MISSED_EVENT_RECOVERY.passed) {
		failureReasons.push(
			input.recovery.eligible === 0
				? "No missed event was produced, so recovery could not be measured (BR-281, AC-5)."
				: `Missed-event recovery ${input.recovery.recovered} of ${input.recovery.eligible} is below 100% (BR-281, AC-5).`
		);
	}
	return {
		gates,
		overallResult:
			failureReasons.length === 0
				? RealtimeEvaluationStatus.PASSED
				: RealtimeEvaluationStatus.FAILED,
		failureReasons,
	};
}

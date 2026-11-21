import { RealtimeEvaluationGateName, RealtimeEvaluationStatus } from "./realtime-evaluation.enums";
import {
	evaluateRealtimeGates,
	latencyStats,
	percentile,
	recoveryStats,
} from "./realtime-evaluation.metrics";

const { SOS_DELIVERY_P95, NORMAL_EVENT_P95, NORMAL_EVENT_P99, MISSED_EVENT_RECOVERY } =
	RealtimeEvaluationGateName;

/** 100 latencies: 95 at `low` ms and 5 at `high` ms, so P95 = low and P99 = high. */
const spread = (low: number, high: number) => [
	...Array.from({ length: 95 }, () => low),
	...Array.from({ length: 5 }, () => high),
];
const ok = latencyStats(Array.from({ length: 100 }, () => 20));
const fullRecovery = recoveryStats(20, 20);

describe("real-time evaluation metrics (CTMS-100)", () => {
	it("uses nearest-rank percentiles", () => {
		const values = Array.from({ length: 100 }, (_, i) => i + 1);
		expect(percentile(values, 95)).toBe(95);
		expect(percentile(values, 99)).toBe(99);
		expect(percentile([7], 95)).toBe(7);
		expect(percentile([], 95)).toBeNull();
	});

	it("counts an undelivered event as infinite latency", () => {
		const fewLost = [...Array.from({ length: 96 }, () => 10), null, null, null, null];
		expect(percentile(fewLost, 95)).toBe(10);
		expect(percentile(fewLost, 99)).toBeNull();
		expect(latencyStats(fewLost)).toMatchObject({
			count: 100,
			delivered: 96,
			undelivered: 4,
			averageMs: 10,
			maxMs: null,
		});
	});

	it("passes SOS P95 at 4.9 s and fails it at exactly 5.0 s (strict gate)", () => {
		const pass = evaluateRealtimeGates({
			sos: latencyStats(spread(4900, 9000)),
			normal: ok,
			recovery: fullRecovery,
		});
		expect(pass.gates[SOS_DELIVERY_P95]).toMatchObject({
			actual: 4900,
			comparator: "<",
			passed: true,
		});
		const fail = evaluateRealtimeGates({
			sos: latencyStats(spread(5000, 9000)),
			normal: ok,
			recovery: fullRecovery,
		});
		expect(fail.gates[SOS_DELIVERY_P95].passed).toBe(false);
		expect(fail.overallResult).toBe(RealtimeEvaluationStatus.FAILED);
		expect(fail.failureReasons[0]).toContain("AC-2");
	});

	it("passes normal P95 at exactly 2 s and P99 at exactly 5 s, fails just above", () => {
		const atGate = latencyStats([
			...Array.from({ length: 95 }, () => 2000),
			...Array.from({ length: 4 }, () => 5000),
			5000,
		]);
		const pass = evaluateRealtimeGates({ sos: ok, normal: atGate, recovery: fullRecovery });
		expect(pass.gates[NORMAL_EVENT_P95]).toMatchObject({ actual: 2000, passed: true });
		expect(pass.gates[NORMAL_EVENT_P99]).toMatchObject({ actual: 5000, passed: true });
		expect(pass.overallResult).toBe(RealtimeEvaluationStatus.PASSED);

		const above = latencyStats([
			...Array.from({ length: 95 }, () => 2001),
			...Array.from({ length: 5 }, () => 5001),
		]);
		const fail = evaluateRealtimeGates({ sos: ok, normal: above, recovery: fullRecovery });
		expect(fail.gates[NORMAL_EVENT_P95].passed).toBe(false);
		expect(fail.gates[NORMAL_EVENT_P99].passed).toBe(false);
	});

	it("fails recovery when one eligible missed event is not recovered, or when nothing was eligible", () => {
		const one = evaluateRealtimeGates({ sos: ok, normal: ok, recovery: recoveryStats(20, 19) });
		expect(one.gates[MISSED_EVENT_RECOVERY]).toMatchObject({ actual: 0.95, passed: false });
		expect(one.failureReasons.join(" ")).toContain("19 of 20");

		const none = evaluateRealtimeGates({ sos: ok, normal: ok, recovery: recoveryStats(0, 0) });
		expect(none.gates[MISSED_EVENT_RECOVERY].passed).toBe(false);
		expect(none.failureReasons.join(" ")).toContain("could not be measured");
	});

	it("fails a latency gate when too many events are lost to compute it", () => {
		const lost = latencyStats([
			...Array.from({ length: 90 }, () => 10),
			...Array.from({ length: 10 }, () => null),
		]);
		const result = evaluateRealtimeGates({ sos: lost, normal: ok, recovery: fullRecovery });
		expect(result.gates[SOS_DELIVERY_P95]).toMatchObject({ actual: null, passed: false });
		expect(result.failureReasons[0]).toContain("10 of 100 SOS events undelivered");
	});

	it("never fails on a high average when the gated percentiles pass (AC6/AC7)", () => {
		const skewed = latencyStats([...Array.from({ length: 99 }, () => 100), 4999]);
		expect(skewed.averageMs).toBeGreaterThan(100);
		const result = evaluateRealtimeGates({ sos: skewed, normal: skewed, recovery: fullRecovery });
		expect(result.overallResult).toBe(RealtimeEvaluationStatus.PASSED);
		expect(Object.keys(result.gates)).toHaveLength(4);
	});
});

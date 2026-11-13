import { ConflictException, NotFoundException } from "@nestjs/common";
import type { RealtimeEventsService } from "../realtime/realtime-events.service";
import { REALTIME_EVALUATION_LIMITS } from "./realtime-evaluation.constants";
import { RealtimeEvaluationScenario, RealtimeEvaluationStatus } from "./realtime-evaluation.enums";
import type {
	RealtimeEvaluationHarness,
	RealtimeHarnessResult,
	RealtimeSampleRecord,
} from "./realtime-evaluation.harness";
import type { RealtimeEvaluationRepository } from "./realtime-evaluation.repository";
import { RealtimeEvaluationService, buildMetrics } from "./realtime-evaluation.service";

const T0 = new Date("2026-11-13T00:00:00.000Z").getTime();

function sample(
	scenario: RealtimeEvaluationScenario,
	latencyMs: number | null,
	warmup = false
): RealtimeSampleRecord {
	return {
		scenario,
		eventType:
			scenario === RealtimeEvaluationScenario.STABLE_SOS
				? "evaluation.probe.sos"
				: "evaluation.probe.normal",
		eventId: latencyMs === null ? null : "55555555-5555-4555-8555-555555555555",
		sequence: latencyMs === null ? null : 1,
		clientIndex: 0,
		warmup,
		sentAt: latencyMs === null ? null : new Date(T0),
		receivedAt: latencyMs === null ? null : new Date(T0 + latencyMs),
		acknowledgedAt: latencyMs === null ? null : new Date(T0 + latencyMs + 2),
		latencyMs,
	};
}

function harnessResult(overrides: Partial<RealtimeHarnessResult> = {}): RealtimeHarnessResult {
	return {
		samples: [
			sample(RealtimeEvaluationScenario.STABLE_SOS, 9000, true),
			...Array.from({ length: 20 }, () => sample(RealtimeEvaluationScenario.STABLE_SOS, 10)),
			...Array.from({ length: 20 }, () => sample(RealtimeEvaluationScenario.CONCURRENT_NORMAL, 30)),
		],
		recovery: { eligible: 5, recovered: 5, truncated: false },
		scenarios: [
			{
				scenario: RealtimeEvaluationScenario.ROOM_RESTORE,
				description: "",
				passed: false,
				details: { rooms: [] },
			},
		],
		observations: { concurrentClients: 4, normalBurstMs: 100, duplicateCopiesFiltered: 6 },
		...overrides,
	};
}

function setup(result = harnessResult()) {
	const harness = { run: jest.fn().mockResolvedValue(result) };
	const repository = {
		saveReport: jest.fn().mockImplementation(async (data) => ({ id: "report-1", ...data })),
		countSamples: jest.fn().mockResolvedValue(3),
		findLatest: jest.fn().mockResolvedValue(null),
		findHistory: jest.fn().mockResolvedValue([]),
		findById: jest.fn().mockResolvedValue(null),
	};
	const realtimeEvents = { reconnectPolicy: jest.fn().mockReturnValue({ initialDelayMs: 1000 }) };
	const service = new RealtimeEvaluationService(
		harness as unknown as RealtimeEvaluationHarness,
		repository as unknown as RealtimeEvaluationRepository,
		realtimeEvents as unknown as RealtimeEventsService
	);
	return { service, harness, repository };
}

describe("RealtimeEvaluationService (CTMS-100)", () => {
	it("runs with the default parameters and stores versions, config, gates and samples", async () => {
		const { service, harness, repository } = setup();
		const report = await service.runEvaluation("admin-1", {});
		expect(harness.run).toHaveBeenCalledWith({
			sosEvents: REALTIME_EVALUATION_LIMITS.sosEvents.default,
			normalEvents: REALTIME_EVALUATION_LIMITS.normalEvents.default,
			concurrentClients: REALTIME_EVALUATION_LIMITS.concurrentClients.default,
			missedEvents: REALTIME_EVALUATION_LIMITS.missedEvents.default,
		});
		expect(report).toMatchObject({
			scenarioVersion: "v3.0.0-realtime-performance",
			configVersion: "v3-realtime-evaluation-1",
			ruleVersion: "BR-281+BR-265+BR-282",
			overallResult: RealtimeEvaluationStatus.PASSED,
			evaluatorId: "admin-1",
			sampleCount: 41,
		});
		expect(report.testConfig).toMatchObject({
			warmupEvents: 5,
			reconnectPolicy: { initialDelayMs: 1000 },
		});
		expect(String(report.testConfig.stableConnection)).toContain("Loopback WebSocket");
		expect(repository.saveReport.mock.calls[0][1]).toHaveLength(41);
	});

	it("keeps a failed scenario check as evidence without adding a release gate", async () => {
		const { service } = setup();
		const report = await service.runEvaluation("admin-1", {});
		expect(report.overallResult).toBe(RealtimeEvaluationStatus.PASSED);
		expect(report.failureReasons).toEqual([]);
		expect(report.scenarioResults[0]).toMatchObject({ scenario: "ROOM_RESTORE", passed: false });
	});

	it("fails when a missed event is not recovered", async () => {
		const { service } = setup(
			harnessResult({ recovery: { eligible: 5, recovered: 4, truncated: false } })
		);
		const report = await service.runEvaluation("admin-1", { missedEvents: 5 });
		expect(report.overallResult).toBe(RealtimeEvaluationStatus.FAILED);
		expect(report.failureReasons[0]).toContain("4 of 5");
	});

	it("allows only one run at a time", async () => {
		let release: (value: RealtimeHarnessResult) => void = () => undefined;
		const { service, harness } = setup();
		harness.run.mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve;
			})
		);
		const first = service.runEvaluation("admin-1", {});
		await expect(service.runEvaluation("admin-1", {})).rejects.toBeInstanceOf(ConflictException);
		release(harnessResult());
		await first;
		await expect(service.runEvaluation("admin-1", {})).resolves.toBeDefined();
	});

	it("bounds history and 404s when a report is missing", async () => {
		const { service, repository } = setup();
		await service.getHistory(500);
		expect(repository.findHistory).toHaveBeenCalledWith(100);
		await expect(service.getLatestReport()).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.getReportById("x")).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("buildMetrics", () => {
	it("measures each gate from its own scenario without warm-up, and reports observations", () => {
		const metrics = buildMetrics(
			harnessResult().samples,
			{ eligible: 5, recovered: 5, truncated: false },
			{ concurrentClients: 4, normalBurstMs: 100, duplicateCopiesFiltered: 6 }
		);
		expect(metrics.sos).toMatchObject({ count: 20, p95Ms: 10 });
		expect(metrics.normal).toMatchObject({ count: 20, p95Ms: 30, averageMs: 30 });
		expect(metrics.recovery).toMatchObject({ eligible: 5, recovered: 5, rate: 1 });
		expect(metrics.observations).toEqual({
			concurrentClients: 4,
			normalEventsPerSecond: 200,
			averageAckMs: 2,
			duplicateCopiesFiltered: 6,
		});
	});
});

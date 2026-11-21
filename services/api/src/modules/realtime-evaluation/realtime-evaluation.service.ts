import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RealtimeEventsService } from "../realtime/realtime-events.service";
import {
	type RealtimeEvaluationReportResponseDto,
	type RunRealtimeEvaluationDto,
	toRealtimeEvaluationReportDto,
} from "./dto/realtime-evaluation.dto";
import type { RealtimeEvaluationMetrics } from "./entities/realtime-evaluation-report.entity";
import {
	REALTIME_EVALUATION_ACK_TIMEOUT_MS,
	REALTIME_EVALUATION_CONFIG_VERSION,
	REALTIME_EVALUATION_DELIVERY_TIMEOUT_MS,
	REALTIME_EVALUATION_HISTORY_LIMIT,
	REALTIME_EVALUATION_LIMITS,
	REALTIME_EVALUATION_MAX_HISTORY_LIMIT,
	REALTIME_EVALUATION_RULE_VERSION,
	REALTIME_EVALUATION_SCENARIO_VERSION,
	REALTIME_EVALUATION_WARMUP_EVENTS,
	REALTIME_RELEASE_GATES,
} from "./realtime-evaluation.constants";
import { RealtimeEvaluationScenario } from "./realtime-evaluation.enums";
import {
	// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
	RealtimeEvaluationHarness,
	type RealtimeEvaluationParams,
	type RealtimeSampleRecord,
} from "./realtime-evaluation.harness";
import { evaluateRealtimeGates, latencyStats, recoveryStats } from "./realtime-evaluation.metrics";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { RealtimeEvaluationRepository } from "./realtime-evaluation.repository";

/** Spec §12 decision (approved 2026-11-13), stored on every report. */
const STABLE_CONNECTION_RULE =
	"Loopback WebSocket (socket.io, websocket transport) to this API instance, no injected delay or loss; every client connected and authenticated before measuring; first 5 events of each latency scenario are warm-up and not measured. Measures the server pipeline (store + emit), not the user's mobile network.";

/**
 * CTMS-100: runs the real-time evaluation, applies the BR-281 gates and keeps the report with its
 * timing samples (BR-265, BR-282). One run at a time.
 */
@Injectable()
export class RealtimeEvaluationService {
	private running = false;

	constructor(
		private readonly harness: RealtimeEvaluationHarness,
		private readonly repository: RealtimeEvaluationRepository,
		private readonly realtimeEvents: RealtimeEventsService
	) {}

	async runEvaluation(
		evaluatorId: string,
		dto: RunRealtimeEvaluationDto
	): Promise<RealtimeEvaluationReportResponseDto> {
		if (this.running) throw new ConflictException("A real-time evaluation is already running");
		this.running = true;
		try {
			const params: RealtimeEvaluationParams = {
				sosEvents: dto.sosEvents ?? REALTIME_EVALUATION_LIMITS.sosEvents.default,
				normalEvents: dto.normalEvents ?? REALTIME_EVALUATION_LIMITS.normalEvents.default,
				concurrentClients:
					dto.concurrentClients ?? REALTIME_EVALUATION_LIMITS.concurrentClients.default,
				missedEvents: dto.missedEvents ?? REALTIME_EVALUATION_LIMITS.missedEvents.default,
			};
			const startedAt = new Date();
			const result = await this.harness.run(params);
			const evaluatedAt = new Date();

			const metrics = buildMetrics(result.samples, result.recovery, result.observations);
			const outcome = evaluateRealtimeGates({
				sos: metrics.sos,
				normal: metrics.normal,
				recovery: metrics.recovery,
			});
			// Scenario results are evidence (AC-5); only the four BR-281 gates decide the release, so a
			// scenario check never becomes an extra gate (spec §10, AC-7).

			const saved = await this.repository.saveReport(
				{
					scenarioVersion: REALTIME_EVALUATION_SCENARIO_VERSION,
					configVersion: REALTIME_EVALUATION_CONFIG_VERSION,
					ruleVersion: REALTIME_EVALUATION_RULE_VERSION,
					testConfig: {
						...params,
						warmupEvents: REALTIME_EVALUATION_WARMUP_EVENTS,
						deliveryTimeoutMs: REALTIME_EVALUATION_DELIVERY_TIMEOUT_MS,
						ackTimeoutMs: REALTIME_EVALUATION_ACK_TIMEOUT_MS,
						stableConnection: STABLE_CONNECTION_RULE,
						percentileMethod: "nearest-rank; undelivered events count as infinite",
						releaseGates: REALTIME_RELEASE_GATES,
						reconnectPolicy: this.realtimeEvents.reconnectPolicy(),
					},
					overallResult: outcome.overallResult,
					startedAt,
					evaluatedAt,
					gates: outcome.gates,
					metrics,
					scenarioResults: result.scenarios,
					failureReasons: outcome.failureReasons,
					evaluatorId,
				},
				result.samples
			);
			return toRealtimeEvaluationReportDto(saved, result.samples.length);
		} finally {
			this.running = false;
		}
	}

	async getLatestReport(): Promise<RealtimeEvaluationReportResponseDto> {
		const report = await this.repository.findLatest();
		if (!report) throw new NotFoundException("No real-time evaluation report yet");
		return toRealtimeEvaluationReportDto(report, await this.repository.countSamples(report.id));
	}

	async getHistory(
		limit = REALTIME_EVALUATION_HISTORY_LIMIT
	): Promise<RealtimeEvaluationReportResponseDto[]> {
		const bounded = Math.min(Math.max(Math.trunc(limit), 1), REALTIME_EVALUATION_MAX_HISTORY_LIMIT);
		const reports = await this.repository.findHistory(bounded);
		return Promise.all(
			reports.map(async (report) =>
				toRealtimeEvaluationReportDto(report, await this.repository.countSamples(report.id))
			)
		);
	}

	async getReportById(id: string): Promise<RealtimeEvaluationReportResponseDto> {
		const report = await this.repository.findById(id);
		if (!report) throw new NotFoundException("Real-time evaluation report not found");
		return toRealtimeEvaluationReportDto(report, await this.repository.countSamples(report.id));
	}
}

/** Gated latencies come only from their own scenario, warm-up excluded. */
export function buildMetrics(
	samples: RealtimeSampleRecord[],
	recovery: { eligible: number; recovered: number; truncated: boolean },
	observations: {
		concurrentClients: number;
		normalBurstMs: number | null;
		duplicateCopiesFiltered: number;
	}
): RealtimeEvaluationMetrics {
	const measured = (scenario: RealtimeEvaluationScenario) =>
		samples.filter((sample) => sample.scenario === scenario && !sample.warmup);
	const sos = measured(RealtimeEvaluationScenario.STABLE_SOS);
	const normal = measured(RealtimeEvaluationScenario.CONCURRENT_NORMAL);
	const ackDelays = samples
		.filter((sample) => sample.acknowledgedAt && sample.receivedAt)
		.map(
			(sample) => (sample.acknowledgedAt as Date).getTime() - (sample.receivedAt as Date).getTime()
		);
	const deliveredNormal = normal.filter((sample) => sample.receivedAt !== null).length;
	return {
		sos: latencyStats(sos.map((sample) => sample.latencyMs)),
		normal: latencyStats(normal.map((sample) => sample.latencyMs)),
		recovery: {
			...recoveryStats(recovery.eligible, recovery.recovered),
			truncated: recovery.truncated,
		},
		observations: {
			concurrentClients: observations.concurrentClients,
			normalEventsPerSecond:
				observations.normalBurstMs && observations.normalBurstMs > 0
					? Number(((deliveredNormal * 1000) / observations.normalBurstMs).toFixed(2))
					: null,
			averageAckMs:
				ackDelays.length === 0
					? null
					: Number(
							(ackDelays.reduce((sum, value) => sum + value, 0) / ackDelays.length).toFixed(2)
						),
			duplicateCopiesFiltered: observations.duplicateCopiesFiltered,
		},
	};
}

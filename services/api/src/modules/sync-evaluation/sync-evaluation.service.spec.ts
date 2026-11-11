import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { GpsLogRepository } from "../gps-tracking/gps-log.repository";
import { GpsTrackingService } from "../gps-tracking/gps-tracking.service";
import { SafetyEventRepository } from "../safety-events/safety-event.repository";
import {
	SafetyEventIngestStatus,
	SafetyEventRejectionReason,
} from "../safety-events/safety-events.enums";
import { SafetyEventsService } from "../safety-events/safety-events.service";
import type { SyncEvaluationReportEntity } from "./entities/sync-evaluation-report.entity";
import {
	DEFAULT_CONFIG_VERSION,
	DEFAULT_DATASET_VERSION,
	DEFAULT_RULE_VERSION,
} from "./sync-evaluation.constants";
import {
	SyncEvaluationGateName,
	SyncEvaluationScenarioType,
	SyncEvaluationStatus,
} from "./sync-evaluation.enums";
import { SyncEvaluationRepository } from "./sync-evaluation.repository";
import { SyncEvaluationService } from "./sync-evaluation.service";

describe("SyncEvaluationService (CTMS-097)", () => {
	let service: SyncEvaluationService;
	let evaluationRepo: jest.Mocked<SyncEvaluationRepository>;
	let gpsService: jest.Mocked<GpsTrackingService>;
	let safetyService: jest.Mocked<SafetyEventsService>;
	let dataSource: jest.Mocked<DataSource>;

	const mockTripId = "11111111-1111-1111-1111-111111111111";
	const mockUserId = "22222222-2222-2222-2222-222222222222";
	const mockRouteId = "33333333-3333-3333-3333-333333333333";
	const mockRouteVersion = "route-v3-md5-hash";

	beforeEach(async () => {
		const mockEvaluationRepo: Partial<SyncEvaluationRepository> = {
			saveReport: jest.fn().mockImplementation((data) =>
				Promise.resolve({
					id: "99999999-9999-9999-9999-999999999999",
					createdAt: new Date(),
					...data,
				})
			),
			findLatest: jest.fn(),
			findHistory: jest.fn(),
			findById: jest.fn(),
		};

		const mockGpsService: Partial<GpsTrackingService> = {
			ingestLogs: jest.fn().mockImplementation((_userId, _tripId, dto) => {
				return Promise.resolve({
					results: dto.logs.map((log: { id: string; eventTime: string }) => {
						// Simulate rejection if eventTime is outside participation
						if (log.eventTime.includes("2025")) {
							return {
								id: log.id,
								status: "rejected",
								reason: "EVENT_TIME_OUTSIDE_PARTICIPATION",
							};
						}
						return { id: log.id, status: "accepted", reason: null };
					}),
				});
			}),
		};

		const mockSafetyService: Partial<SafetyEventsService> = {
			ingestEvents: jest.fn().mockImplementation((_userId, _tripId, dto) => {
				return Promise.resolve({
					results: dto.events.map((e: { id: string; routeVersion: string }) => {
						if (e.routeVersion === "invalid-route-version-hash") {
							return {
								id: e.id,
								status: SafetyEventIngestStatus.REJECTED,
								reason: SafetyEventRejectionReason.ROUTE_VERSION_MISMATCH,
							};
						}
						return {
							id: e.id,
							status: SafetyEventIngestStatus.ACCEPTED,
							reason: null,
						};
					}),
				});
			}),
		};

		const mockDataSource: Partial<DataSource> = {
			query: jest.fn().mockImplementation((sql: string) => {
				if (sql.includes('FROM "trips" trip')) {
					return Promise.resolve([
						{
							tripId: mockTripId,
							userId: mockUserId,
							routeId: mockRouteId,
							routeVersion: mockRouteVersion,
							tripStart: new Date("2026-10-25T00:00:00Z"),
						},
					]);
				}
				if (sql.includes('COUNT(*) - 1 AS "excess"')) {
					// zero duplicate rows found in DB
					return Promise.resolve([]);
				}
				return Promise.resolve([]);
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SyncEvaluationService,
				{ provide: SyncEvaluationRepository, useValue: mockEvaluationRepo },
				{ provide: GpsTrackingService, useValue: mockGpsService },
				{ provide: SafetyEventsService, useValue: mockSafetyService },
				{ provide: GpsLogRepository, useValue: {} },
				{ provide: SafetyEventRepository, useValue: {} },
				{ provide: DataSource, useValue: mockDataSource },
			],
		}).compile();

		service = module.get<SyncEvaluationService>(SyncEvaluationService);
		evaluationRepo = module.get(SyncEvaluationRepository);
		gpsService = module.get(GpsTrackingService);
		safetyService = module.get(SafetyEventsService);
		dataSource = module.get(DataSource);
	});

	it("executes all 6 scenarios and passes release gates when all invariants are satisfied (BR-278, BR-436)", async () => {
		const seenGpsIds = new Set<string>();
		gpsService.ingestLogs.mockImplementation((_userId, _tripId, dto) => {
			return Promise.resolve({
				results: dto.logs.map((log) => {
					if (log.eventTime.includes("2025")) {
						return {
							id: log.id,
							status: "rejected",
							reason: "EVENT_TIME_OUTSIDE_PARTICIPATION",
						};
					}
					if (seenGpsIds.has(log.id)) {
						return { id: log.id, status: "duplicate", reason: null };
					}
					seenGpsIds.add(log.id);
					return { id: log.id, status: "accepted", reason: null };
				}),
			});
		});

		const seenSafetyIds = new Set<string>();
		safetyService.ingestEvents.mockImplementation((_userId, _tripId, dto) => {
			return Promise.resolve({
				results: dto.events.map((e) => {
					if (e.routeVersion === "invalid-route-version-hash") {
						return {
							id: e.id,
							status: SafetyEventIngestStatus.REJECTED,
							reason: SafetyEventRejectionReason.ROUTE_VERSION_MISMATCH,
						};
					}
					if (seenSafetyIds.has(e.id)) {
						return {
							id: e.id,
							status: SafetyEventIngestStatus.DUPLICATE,
							reason: null,
						};
					}
					seenSafetyIds.add(e.id);
					return {
						id: e.id,
						status: SafetyEventIngestStatus.ACCEPTED,
						reason: null,
					};
				}),
			});
		});

		const report = await service.runEvaluation(mockUserId, {
			datasetVersion: DEFAULT_DATASET_VERSION,
		});

		expect(report).toBeDefined();
		expect(report.datasetVersion).toBe(DEFAULT_DATASET_VERSION);
		expect(report.configVersion).toBe(DEFAULT_CONFIG_VERSION);
		expect(report.ruleVersion).toBe(DEFAULT_RULE_VERSION);
		expect(report.overallResult).toBe(SyncEvaluationStatus.PASSED);

		// Check Release Gates
		const gates = report.gates;
		expect(gates[SyncEvaluationGateName.VALID_RECORD_ACCEPTANCE].passed).toBe(true);
		expect(gates[SyncEvaluationGateName.VALID_RECORD_ACCEPTANCE].actual).toBe(1.0);
		expect(gates[SyncEvaluationGateName.SAFETY_EVENT_LOSS].passed).toBe(true);
		expect(gates[SyncEvaluationGateName.SAFETY_EVENT_LOSS].actual).toBe(0);
		expect(gates[SyncEvaluationGateName.AUTHORITATIVE_DUPLICATE].passed).toBe(true);
		expect(gates[SyncEvaluationGateName.AUTHORITATIVE_DUPLICATE].actual).toBe(0);

		// Check Observational Metrics (BR-282)
		expect(report.metrics.retryCount).toBeGreaterThanOrEqual(1);
		expect(report.metrics.avgBatchDelayMs).toBeGreaterThanOrEqual(0);
		expect(report.metrics.errorsBreakdown.ROUTE_VERSION_MISMATCH).toBe(1);

		// Check 6 scenarios were recorded
		expect(report.scenarioResults).toHaveLength(6);
		expect(evaluationRepo.saveReport).toHaveBeenCalledTimes(1);
	});

	it("fails release gate when a valid record is lost/rejected (BR-278)", async () => {
		// Simulate server dropping/rejecting a valid log unexpectedly
		gpsService.ingestLogs.mockResolvedValueOnce({
			results: [
				{ id: "log-1", status: "rejected", reason: "INTERNAL_ERROR" },
				{ id: "log-2", status: "accepted", reason: null },
			],
		});

		const report = await service.runEvaluation(mockUserId, {
			scenarios: [SyncEvaluationScenarioType.CONNECTIVITY_LOSS],
		});

		expect(report.overallResult).toBe(SyncEvaluationStatus.FAILED);
		expect(report.gates[SyncEvaluationGateName.VALID_RECORD_ACCEPTANCE].passed).toBe(false);
		expect(report.failureReasons.length).toBeGreaterThan(0);
		expect(report.failureReasons[0]).toContain("Valid record acceptance rate");
	});

	it("fails release gate when authoritative duplicates are detected in the database (BR-278, BR-442)", async () => {
		// Mock duplicate query returning 2 duplicate rows found in DB
		dataSource.query.mockImplementation((sql: string) => {
			if (sql.includes('FROM "trips" trip')) {
				return Promise.resolve([
					{
						tripId: mockTripId,
						userId: mockUserId,
						routeId: mockRouteId,
						routeVersion: mockRouteVersion,
						tripStart: new Date("2026-10-25T00:00:00Z"),
					},
				]);
			}
			if (sql.includes('COUNT(*) - 1 AS "excess"')) {
				return Promise.resolve([{ excess: 2 }]);
			}
			return Promise.resolve([]);
		});

		const report = await service.runEvaluation(mockUserId, {
			scenarios: [SyncEvaluationScenarioType.DUPLICATE_BATCHES],
		});

		expect(report.overallResult).toBe(SyncEvaluationStatus.FAILED);
		expect(report.gates[SyncEvaluationGateName.AUTHORITATIVE_DUPLICATE].passed).toBe(false);
		expect(report.gates[SyncEvaluationGateName.AUTHORITATIVE_DUPLICATE].actual).toBeGreaterThan(0);
		expect(report.failureReasons.some((r) => r.includes("authoritative duplicate records"))).toBe(
			true
		);
	});

	it("handles partial-failure batch: accepts valid records independently without rolling back (BR-441)", async () => {
		const report = await service.runEvaluation(mockUserId, {
			scenarios: [SyncEvaluationScenarioType.PARTIAL_FAILURE],
		});

		expect(report.overallResult).toBe(SyncEvaluationStatus.PASSED);
		expect(report.metrics.validRecordsAccepted).toBe(2);
		expect(report.metrics.errorsBreakdown.EVENT_TIME_OUTSIDE_PARTICIPATION).toBe(1);
	});

	it("throws NotFoundException when no eligible trip exists for evaluation", async () => {
		dataSource.query.mockImplementation((sql: string) => {
			if (sql.includes('FROM "trips" trip')) {
				return Promise.resolve([]);
			}
			return Promise.resolve([]);
		});

		await expect(service.runEvaluation(mockUserId)).rejects.toThrow(NotFoundException);
	});

	it("retrieves the latest report and history", async () => {
		const mockSavedReport = {
			id: "report-123",
			datasetVersion: DEFAULT_DATASET_VERSION,
			overallResult: SyncEvaluationStatus.PASSED,
		} as unknown as SyncEvaluationReportEntity;
		evaluationRepo.findLatest.mockResolvedValue(mockSavedReport);
		evaluationRepo.findHistory.mockResolvedValue([mockSavedReport]);
		evaluationRepo.findById.mockResolvedValue(mockSavedReport);

		const latest = await service.getLatestReport();
		expect(latest.id).toBe("report-123");

		const history = await service.getHistory(10);
		expect(history).toHaveLength(1);

		const single = await service.getReportById("report-123");
		expect(single.id).toBe("report-123");
	});

	it("throws NotFoundException when latest report does not exist", async () => {
		evaluationRepo.findLatest.mockResolvedValue(null);
		await expect(service.getLatestReport()).rejects.toThrow(NotFoundException);
	});
});

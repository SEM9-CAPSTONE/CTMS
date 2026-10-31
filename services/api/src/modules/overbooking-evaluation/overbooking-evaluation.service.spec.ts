import { ConflictException, NotFoundException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import type { BookingsService } from "../bookings/bookings.service";
import type { BookingResponseDto } from "../bookings/dto/booking-response.dto";
import type { OverbookingEvaluationReportEntity } from "./entities/overbooking-evaluation-report.entity";
import {
	DEFAULT_CONFIG_VERSION,
	DEFAULT_DATASET_VERSION,
	DEFAULT_RULE_VERSION,
} from "./overbooking-evaluation.constants";
import {
	OverbookingEvaluationGateName,
	OverbookingEvaluationScenarioType,
	OverbookingEvaluationStatus,
} from "./overbooking-evaluation.enums";
import type { OverbookingEvaluationRepository } from "./overbooking-evaluation.repository";
import { OverbookingEvaluationService } from "./overbooking-evaluation.service";

describe("OverbookingEvaluationService (CTMS-095)", () => {
	let service: OverbookingEvaluationService;
	let bookingsService: jest.Mocked<BookingsService>;
	let evaluationRepo: jest.Mocked<OverbookingEvaluationRepository>;
	let dataSource: jest.Mocked<DataSource>;

	const TRIP_ID = "11111111-1111-4111-8111-111111111111";
	const USER_ID = "22222222-2222-4222-8222-222222222222";

	beforeEach(() => {
		bookingsService = {
			create: jest.fn(),
		} as unknown as jest.Mocked<BookingsService>;

		evaluationRepo = {
			saveReport: jest.fn().mockImplementation((data) => ({
				id: "report-123",
				...data,
				createdAt: new Date(),
			})),
			findLatest: jest.fn(),
			findHistory: jest.fn(),
			findById: jest.fn(),
		} as unknown as jest.Mocked<OverbookingEvaluationRepository>;

		dataSource = {
			query: jest.fn(),
		} as unknown as jest.Mocked<DataSource>;

		service = new OverbookingEvaluationService(bookingsService, evaluationRepo, dataSource);
	});

	describe("runEvaluation (AC1, AC2, AC3, AC4, AC5)", () => {
		it("runs evaluation scenarios successfully and passes the ZERO_OVERBOOKING release gate", async () => {
			// Mock resolveEvaluationUsers
			dataSource.query.mockImplementation(async (sql: string) => {
				if (sql.includes('FROM "users"')) {
					return [{ id: USER_ID }, { id: "user-2" }, { id: "user-3" }];
				}
				if (sql.includes('FROM "trips" trip') && sql.includes("trip.\"status\" = 'published'")) {
					return [{ id: TRIP_ID, capacityMax: 10, seatsTaken: 0 }];
				}
				if (sql.includes('DELETE FROM "bookings"')) {
					return [];
				}
				if (sql.includes('SELECT "capacity_max" AS "capacityMax"')) {
					// Return capacity 5 and seatsTaken 5 (no overbooking)
					return [{ capacityMax: 5, seatsTaken: 5 }];
				}
				return [];
			});

			// Bookings succeed
			bookingsService.create.mockResolvedValue({
				id: "booking-1",
				tripId: TRIP_ID,
				userId: USER_ID,
				numPeople: 1,
			} as unknown as BookingResponseDto);

			const report = await service.runEvaluation("admin-id", {
				scenarios: [OverbookingEvaluationScenarioType.EXACT_CAPACITY_CONCURRENT],
			});

			expect(report.overallResult).toBe(OverbookingEvaluationStatus.PASSED);
			expect(report.datasetVersion).toBe(DEFAULT_DATASET_VERSION);
			expect(report.configVersion).toBe(DEFAULT_CONFIG_VERSION);
			expect(report.ruleVersion).toBe(DEFAULT_RULE_VERSION);
			expect(report.gates[OverbookingEvaluationGateName.ZERO_OVERBOOKING].passed).toBe(true);
			expect(report.gates[OverbookingEvaluationGateName.ZERO_OVERBOOKING].actual).toBe(0);
			expect(report.failureReasons).toHaveLength(0);
			expect(report.metrics.totalRequests).toBe(5);
			expect(report.metrics.successfulBookings).toBe(5);
			expect(report.metrics.rejectedFullCapacity).toBe(0);
			expect(report.metrics.avgLockLatencyMs).toBeGreaterThanOrEqual(0);
			expect(report.scenarioResults).toHaveLength(1);
			expect(report.scenarioResults[0].passed).toBe(true);
		});

		it("fails the release gate if seats_taken exceeds capacity_max (AC3)", async () => {
			dataSource.query.mockImplementation(async (sql: string) => {
				if (sql.includes('FROM "users"')) {
					return [{ id: USER_ID }];
				}
				if (sql.includes('FROM "trips" trip') && sql.includes("trip.\"status\" = 'published'")) {
					return [{ id: TRIP_ID, capacityMax: 5, seatsTaken: 0 }];
				}
				if (sql.includes('SELECT "capacity_max" AS "capacityMax"')) {
					// Simulate overbooking violation: capacity is 5 but seats_taken is 6!
					return [{ capacityMax: 5, seatsTaken: 6 }];
				}
				return [];
			});

			bookingsService.create.mockResolvedValue({} as unknown as BookingResponseDto);

			const report = await service.runEvaluation("admin-id", {
				scenarios: [OverbookingEvaluationScenarioType.EXACT_CAPACITY_CONCURRENT],
			});

			expect(report.overallResult).toBe(OverbookingEvaluationStatus.FAILED);
			expect(report.gates[OverbookingEvaluationGateName.ZERO_OVERBOOKING].passed).toBe(false);
			expect(report.gates[OverbookingEvaluationGateName.ZERO_OVERBOOKING].actual).toBe(1);
			expect(report.failureReasons[0]).toContain("Mandatory release gate ZERO_OVERBOOKING failed");
		});

		it("correctly records full-capacity rejections when demand exceeds capacity (AC2)", async () => {
			dataSource.query.mockImplementation(async (sql: string) => {
				if (sql.includes('FROM "users"')) {
					return [{ id: USER_ID }, { id: "user-2" }];
				}
				if (sql.includes('FROM "trips" trip') && sql.includes("trip.\"status\" = 'published'")) {
					return [{ id: TRIP_ID, capacityMax: 5, seatsTaken: 0 }];
				}
				if (sql.includes('SELECT "capacity_max" AS "capacityMax"')) {
					return [{ capacityMax: 5, seatsTaken: 5 }];
				}
				return [];
			});

			// 5 calls succeed, 5 calls fail with ConflictException: full capacity
			let callCount = 0;
			bookingsService.create.mockImplementation(async () => {
				callCount++;
				if (callCount <= 5) {
					return { id: `b-${callCount}` } as unknown as BookingResponseDto;
				}
				throw new ConflictException("Trip has only 0 seat(s) remaining");
			});

			const report = await service.runEvaluation("admin-id", {
				scenarios: [OverbookingEvaluationScenarioType.OVERSUBSCRIPTION_CONCURRENT],
			});

			expect(report.overallResult).toBe(OverbookingEvaluationStatus.PASSED);
			expect(report.metrics.successfulBookings).toBe(5);
			expect(report.metrics.rejectedFullCapacity).toBe(5);
			expect(report.metrics.errorsBreakdown.FULL_CAPACITY_CONFLICT).toBe(5);
		});

		it("provisions and cleans up an ephemeral trip when no existing trip is available", async () => {
			let createdEphemeralId = "";
			dataSource.query.mockImplementation(async (sql: string, params?: unknown[]) => {
				if (sql.includes('FROM "users"')) {
					return [{ id: USER_ID }];
				}
				if (sql.includes('FROM "trips" trip') && sql.includes("trip.\"status\" = 'published'")) {
					// No existing published trips in DB
					return [];
				}
				if (sql.includes('FROM "trekking_routes"')) {
					return [{ id: "route-uuid-1" }];
				}
				if (sql.includes('INSERT INTO "trips"')) {
					createdEphemeralId = (params as string[])[0];
					return [];
				}
				if (sql.includes('SELECT "capacity_max" AS "capacityMax"')) {
					return [{ capacityMax: 5, seatsTaken: 5 }];
				}
				return [];
			});

			bookingsService.create.mockResolvedValue({ id: "b-1" } as unknown as BookingResponseDto);

			const report = await service.runEvaluation("admin-id", {
				scenarios: [OverbookingEvaluationScenarioType.EXACT_CAPACITY_CONCURRENT],
			});

			expect(report.overallResult).toBe(OverbookingEvaluationStatus.PASSED);
			expect(createdEphemeralId).toBeDefined();
			// Ephemeral cleanup check: DELETE FROM "trips" WHERE "id" = $1
			expect(dataSource.query).toHaveBeenCalledWith(
				expect.stringContaining('DELETE FROM "trips" WHERE "id" = $1'),
				[createdEphemeralId]
			);
		});
	});

	describe("getLatestReport, getHistory, getReportById", () => {
		it("returns latest report if exists", async () => {
			const mockReport = { id: "report-1" } as unknown as OverbookingEvaluationReportEntity;
			evaluationRepo.findLatest.mockResolvedValue(mockReport);

			const result = await service.getLatestReport();
			expect(result.id).toBe("report-1");
		});

		it("throws NotFoundException if latest report does not exist", async () => {
			evaluationRepo.findLatest.mockResolvedValue(null);

			await expect(service.getLatestReport()).rejects.toThrow(NotFoundException);
		});

		it("returns historical reports list", async () => {
			evaluationRepo.findHistory.mockResolvedValue([
				{ id: "r-1" } as unknown as OverbookingEvaluationReportEntity,
				{ id: "r-2" } as unknown as OverbookingEvaluationReportEntity,
			]);

			const list = await service.getHistory(10);
			expect(list).toHaveLength(2);
			expect(evaluationRepo.findHistory).toHaveBeenCalledWith(10);
		});

		it("returns report by id", async () => {
			const mockReport = { id: "r-123" } as unknown as OverbookingEvaluationReportEntity;
			evaluationRepo.findById.mockResolvedValue(mockReport);

			const result = await service.getReportById("r-123");
			expect(result.id).toBe("r-123");
		});

		it("throws NotFoundException if report id not found", async () => {
			evaluationRepo.findById.mockResolvedValue(null);

			await expect(service.getReportById("unknown")).rejects.toThrow(NotFoundException);
		});
	});
});

import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { BookingsService } from "../bookings/bookings.service";
import type {
	OverbookingEvaluationReportResponseDto,
	OverbookingGateResultDto,
	OverbookingMetricSummaryDto,
	OverbookingScenarioExecutionResultDto,
	RunOverbookingEvaluationDto,
} from "./dto/overbooking-evaluation.dto";
import type { OverbookingEvaluationReportEntity } from "./entities/overbooking-evaluation-report.entity";
import {
	DEFAULT_CONFIG_VERSION,
	DEFAULT_DATASET_VERSION,
	DEFAULT_RULE_VERSION,
	RELEASE_GATE_THRESHOLDS,
} from "./overbooking-evaluation.constants";
import {
	OverbookingEvaluationGateName,
	OverbookingEvaluationScenarioType,
	OverbookingEvaluationStatus,
} from "./overbooking-evaluation.enums";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { OverbookingEvaluationRepository } from "./overbooking-evaluation.repository";

interface EvaluationContext {
	tripId: string;
	capacityMax: number;
	initialSeatsTaken: number;
	isEphemeral: boolean;
	userIds: string[];
}

interface BookingAttemptResult {
	success: boolean;
	fullCapacityRejected: boolean;
	conflict: boolean;
	isReplay: boolean;
	retries: number;
	seatsRequested: number;
	seatsAllocated: number;
	latencyMs: number;
	errorCode?: string;
}

@Injectable()
export class OverbookingEvaluationService {
	private readonly logger = new Logger(OverbookingEvaluationService.name);

	constructor(
		private readonly bookingsService: BookingsService,
		private readonly evaluationRepo: OverbookingEvaluationRepository,
		private readonly dataSource: DataSource
	) {}

	/**
	 * CTMS-095 (BR-276, BR-282, AC1-AC5).
	 * Evaluates trip overbooking prevention under concurrent booking scenarios.
	 * Proves that seats_taken never exceeds capacity_max in any scenario.
	 */
	async runEvaluation(
		evaluatorId: string | null,
		dto?: RunOverbookingEvaluationDto
	): Promise<OverbookingEvaluationReportResponseDto> {
		const datasetVersion = dto?.datasetVersion ?? DEFAULT_DATASET_VERSION;
		const configVersion = DEFAULT_CONFIG_VERSION;
		const ruleVersion = DEFAULT_RULE_VERSION;
		const requestedScenarios = dto?.scenarios ?? Object.values(OverbookingEvaluationScenarioType);

		const context = await this.resolveEvaluationContext(dto?.tripId);

		const scenarioResults: OverbookingScenarioExecutionResultDto[] = [];
		const allDelays: number[] = [];
		const errorsBreakdown: Record<string, number> = {};

		let totalRequests = 0;
		let successfulBookings = 0;
		let rejectedFullCapacity = 0;
		let transactionConflicts = 0;
		let transactionRetries = 0;
		let totalSeatsRequested = 0;
		let totalSeatsAllocated = 0;
		let totalOverbookingViolations = 0;

		try {
			for (const scenario of requestedScenarios) {
				let result: OverbookingScenarioExecutionResultDto;

				switch (scenario) {
					case OverbookingEvaluationScenarioType.EXACT_CAPACITY_CONCURRENT:
						result = await this.evaluateExactCapacityConcurrent(context);
						break;
					case OverbookingEvaluationScenarioType.OVERSUBSCRIPTION_CONCURRENT:
						result = await this.evaluateOversubscriptionConcurrent(context);
						break;
					case OverbookingEvaluationScenarioType.BURST_CONTENTION:
						result = await this.evaluateBurstContention(context);
						break;
					case OverbookingEvaluationScenarioType.MULTI_SEAT_EDGE_CASES:
						result = await this.evaluateMultiSeatEdgeCases(context);
						break;
					case OverbookingEvaluationScenarioType.IDEMPOTENT_CONCURRENT_REPLAY:
						result = await this.evaluateIdempotentConcurrentReplay(context);
						break;
					default:
						continue;
				}

				totalRequests += result.totalRequests;
				successfulBookings += result.successfulRequests;
				rejectedFullCapacity += result.rejectedRequests;
				totalOverbookingViolations += result.overbookingViolations;

				const details = result.details as {
					delays?: number[];
					conflicts?: number;
					retries?: number;
					seatsRequested?: number;
					seatsAllocated?: number;
					errors?: Record<string, number>;
				};

				if (details.delays) {
					allDelays.push(...details.delays);
				}
				if (details.conflicts) {
					transactionConflicts += details.conflicts;
				}
				if (details.retries) {
					transactionRetries += details.retries;
				}
				if (details.seatsRequested) {
					totalSeatsRequested += details.seatsRequested;
				}
				if (details.seatsAllocated) {
					totalSeatsAllocated += details.seatsAllocated;
				}
				if (details.errors) {
					this.accumulateErrors(errorsBreakdown, details.errors);
				}

				scenarioResults.push(result);
			}
		} finally {
			if (context.isEphemeral) {
				await this.cleanupEphemeralTrip(context.tripId);
			}
		}

		// Calculate latency metrics (AC2, AC4)
		const avgLockLatencyMs =
			allDelays.length > 0
				? Number((allDelays.reduce((sum, d) => sum + d, 0) / allDelays.length).toFixed(2))
				: 0;
		const maxLockLatencyMs = allDelays.length > 0 ? Math.max(...allDelays) : 0;
		const minLockLatencyMs = allDelays.length > 0 ? Math.min(...allDelays) : 0;
		const p95LockLatencyMs = allDelays.length > 0 ? this.calculateP95(allDelays) : 0;

		const metrics: OverbookingMetricSummaryDto = {
			totalScenarios: scenarioResults.length,
			totalRequests,
			successfulBookings,
			rejectedFullCapacity,
			transactionConflicts,
			transactionRetries,
			totalSeatsRequested,
			totalSeatsAllocated,
			overbookingCount: totalOverbookingViolations,
			avgLockLatencyMs,
			maxLockLatencyMs,
			p95LockLatencyMs,
			minLockLatencyMs,
			errorsBreakdown,
		};

		// Evaluate Gates (BR-276, BR-282, AC3, AC4)
		// Release gate: seats_taken never exceeds capacity_max in any evaluation case (0 overbooking).
		const zeroOverbookingPassed =
			totalOverbookingViolations <= RELEASE_GATE_THRESHOLDS.MAX_OVERBOOKING_COUNT;

		const gates: Record<string, OverbookingGateResultDto> = {
			[OverbookingEvaluationGateName.ZERO_OVERBOOKING]: {
				gateName: OverbookingEvaluationGateName.ZERO_OVERBOOKING,
				threshold: RELEASE_GATE_THRESHOLDS.MAX_OVERBOOKING_COUNT,
				actual: totalOverbookingViolations,
				passed: zeroOverbookingPassed,
				unit: "violations",
			},
		};

		const failureReasons: string[] = [];
		if (!zeroOverbookingPassed) {
			failureReasons.push(
				`Mandatory release gate ZERO_OVERBOOKING failed: detected ${totalOverbookingViolations} overbooking violation(s) where seats_taken exceeded capacity_max (BR-276, AC3).`
			);
		}

		const allScenariosPassed = scenarioResults.every((s) => s.passed);
		if (!allScenariosPassed && zeroOverbookingPassed) {
			failureReasons.push("One or more evaluation scenario invariants failed.");
		}

		const overallResult =
			failureReasons.length === 0 && allScenariosPassed
				? OverbookingEvaluationStatus.PASSED
				: OverbookingEvaluationStatus.FAILED;

		const evaluatedAt = new Date();

		const saved = await this.evaluationRepo.saveReport({
			datasetVersion,
			configVersion,
			ruleVersion,
			overallResult,
			evaluatedAt,
			gates,
			metrics,
			scenarioResults,
			failureReasons,
			evaluatorId,
		});

		return this.mapToResponse(saved);
	}

	async getLatestReport(): Promise<OverbookingEvaluationReportResponseDto> {
		const latest = await this.evaluationRepo.findLatest();
		if (!latest) {
			throw new NotFoundException(
				"No overbooking evaluation report found. Run an evaluation first."
			);
		}
		return this.mapToResponse(latest);
	}

	async getHistory(limit = 20): Promise<OverbookingEvaluationReportResponseDto[]> {
		const list = await this.evaluationRepo.findHistory(limit);
		return list.map((item) => this.mapToResponse(item));
	}

	async getReportById(id: string): Promise<OverbookingEvaluationReportResponseDto> {
		const report = await this.evaluationRepo.findById(id);
		if (!report) {
			throw new NotFoundException(`Overbooking evaluation report ${id} not found`);
		}
		return this.mapToResponse(report);
	}

	// --------------------------------------------------------------------------
	// Scenario 1: Exact Capacity Concurrent
	// --------------------------------------------------------------------------
	private async evaluateExactCapacityConcurrent(
		ctx: EvaluationContext
	): Promise<OverbookingScenarioExecutionResultDto> {
		const capacity = 5;
		await this.resetTripState(ctx.tripId, capacity, 0);

		const requests = Array.from({ length: 5 }, (_, i) => ({
			userId: ctx.userIds[i % ctx.userIds.length],
			numPeople: 1,
			idempotencyKey: randomUUID(),
		}));

		const start = Date.now();
		const results = await Promise.all(requests.map((req) => this.attemptBooking(ctx.tripId, req)));

		const finalTrip = await this.fetchTripCapacityState(ctx.tripId);
		const successful = results.filter((r) => r.success).length;
		const rejected = results.filter((r) => r.fullCapacityRejected).length;
		const delays = results.map((r) => r.latencyMs);
		const conflicts = results.filter((r) => r.conflict).length;
		const errors: Record<string, number> = {};
		for (const r of results) {
			if (r.errorCode) errors[r.errorCode] = (errors[r.errorCode] ?? 0) + 1;
		}

		const overbookingViolations = Math.max(0, finalTrip.seatsTaken - finalTrip.capacityMax);
		const passed =
			overbookingViolations === 0 &&
			finalTrip.seatsTaken === capacity &&
			successful === capacity &&
			rejected === 0;

		return {
			scenario: OverbookingEvaluationScenarioType.EXACT_CAPACITY_CONCURRENT,
			description:
				"Evaluates concurrent booking requests matching exact Trip capacity. Proves all succeed without exceeding capacity_max.",
			tripCapacity: finalTrip.capacityMax,
			initialSeatsTaken: 0,
			finalSeatsTaken: finalTrip.seatsTaken,
			totalRequests: requests.length,
			successfulRequests: successful,
			rejectedRequests: rejected,
			overbookingViolations,
			avgLockLatencyMs: this.calculateAvg(delays),
			passed,
			details: {
				executionTimeMs: Date.now() - start,
				delays,
				conflicts,
				retries: 0,
				seatsRequested: 5,
				seatsAllocated: finalTrip.seatsTaken,
				errors,
			},
		};
	}

	// --------------------------------------------------------------------------
	// Scenario 2: Oversubscription Concurrent
	// --------------------------------------------------------------------------
	private async evaluateOversubscriptionConcurrent(
		ctx: EvaluationContext
	): Promise<OverbookingScenarioExecutionResultDto> {
		const capacity = 5;
		await this.resetTripState(ctx.tripId, capacity, 0);

		// 10 concurrent requests for 5 capacity (2x oversubscribed)
		const requests = Array.from({ length: 10 }, (_, i) => ({
			userId: ctx.userIds[i % ctx.userIds.length],
			numPeople: 1,
			idempotencyKey: randomUUID(),
		}));

		const start = Date.now();
		const results = await Promise.all(requests.map((req) => this.attemptBooking(ctx.tripId, req)));

		const finalTrip = await this.fetchTripCapacityState(ctx.tripId);
		const successful = results.filter((r) => r.success).length;
		const rejected = results.filter((r) => r.fullCapacityRejected).length;
		const delays = results.map((r) => r.latencyMs);
		const conflicts = results.filter((r) => r.conflict).length;
		const errors: Record<string, number> = {};
		for (const r of results) {
			if (r.errorCode) errors[r.errorCode] = (errors[r.errorCode] ?? 0) + 1;
		}

		const overbookingViolations = Math.max(0, finalTrip.seatsTaken - finalTrip.capacityMax);
		const passed =
			overbookingViolations === 0 &&
			finalTrip.seatsTaken === capacity &&
			successful === capacity &&
			rejected === 5;

		return {
			scenario: OverbookingEvaluationScenarioType.OVERSUBSCRIPTION_CONCURRENT,
			description:
				"Evaluates concurrent oversubscribed booking requests (10 requests for 5 seats). Proves exactly 5 succeed, 5 are rejected, and seats_taken never exceeds capacity_max.",
			tripCapacity: finalTrip.capacityMax,
			initialSeatsTaken: 0,
			finalSeatsTaken: finalTrip.seatsTaken,
			totalRequests: requests.length,
			successfulRequests: successful,
			rejectedRequests: rejected,
			overbookingViolations,
			avgLockLatencyMs: this.calculateAvg(delays),
			passed,
			details: {
				executionTimeMs: Date.now() - start,
				delays,
				conflicts,
				retries: 0,
				seatsRequested: 10,
				seatsAllocated: finalTrip.seatsTaken,
				errors,
			},
		};
	}

	// --------------------------------------------------------------------------
	// Scenario 3: Burst Contention
	// --------------------------------------------------------------------------
	private async evaluateBurstContention(
		ctx: EvaluationContext
	): Promise<OverbookingScenarioExecutionResultDto> {
		const capacity = 4;
		const initialSeats = 2; // only 2 seats remaining
		await this.resetTripState(ctx.tripId, capacity, initialSeats);

		// 12 burst concurrent requests contending for remaining 2 seats
		const requests = Array.from({ length: 12 }, (_, i) => ({
			userId: ctx.userIds[i % ctx.userIds.length],
			numPeople: 1,
			idempotencyKey: randomUUID(),
		}));

		const start = Date.now();
		const results = await Promise.all(requests.map((req) => this.attemptBooking(ctx.tripId, req)));

		const finalTrip = await this.fetchTripCapacityState(ctx.tripId);
		const successful = results.filter((r) => r.success).length;
		const rejected = results.filter((r) => r.fullCapacityRejected).length;
		const delays = results.map((r) => r.latencyMs);
		const conflicts = results.filter((r) => r.conflict).length;
		const errors: Record<string, number> = {};
		for (const r of results) {
			if (r.errorCode) errors[r.errorCode] = (errors[r.errorCode] ?? 0) + 1;
		}

		const overbookingViolations = Math.max(0, finalTrip.seatsTaken - finalTrip.capacityMax);
		const passed =
			overbookingViolations === 0 &&
			finalTrip.seatsTaken === capacity &&
			successful === capacity - initialSeats &&
			rejected === requests.length - successful;

		return {
			scenario: OverbookingEvaluationScenarioType.BURST_CONTENTION,
			description:
				"Evaluates high-concurrency burst contending for final remaining seats (12 requests for 2 seats). Captures locking latency distribution and verifies strict capacity containment.",
			tripCapacity: finalTrip.capacityMax,
			initialSeatsTaken: initialSeats,
			finalSeatsTaken: finalTrip.seatsTaken,
			totalRequests: requests.length,
			successfulRequests: successful,
			rejectedRequests: rejected,
			overbookingViolations,
			avgLockLatencyMs: this.calculateAvg(delays),
			passed,
			details: {
				executionTimeMs: Date.now() - start,
				delays,
				p95DelayMs: this.calculateP95(delays),
				maxDelayMs: delays.length > 0 ? Math.max(...delays) : 0,
				minDelayMs: delays.length > 0 ? Math.min(...delays) : 0,
				conflicts,
				retries: 0,
				seatsRequested: 12,
				seatsAllocated: successful,
				errors,
			},
		};
	}

	// --------------------------------------------------------------------------
	// Scenario 4: Multi-Seat Edge Cases
	// --------------------------------------------------------------------------
	private async evaluateMultiSeatEdgeCases(
		ctx: EvaluationContext
	): Promise<OverbookingScenarioExecutionResultDto> {
		const capacity = 6;
		const initialSeats = 3; // 3 seats remaining
		await this.resetTripState(ctx.tripId, capacity, initialSeats);

		// Requests with sizes [2, 3, 4, 1]
		// 4 cannot fit (rejected).
		// Either (3) fits, or (2, 1) fit. In all cases, seats_taken <= 6.
		const seatSizes = [2, 3, 4, 1];
		const requests = seatSizes.map((size, idx) => ({
			userId: ctx.userIds[idx % ctx.userIds.length],
			numPeople: size,
			idempotencyKey: randomUUID(),
		}));

		const start = Date.now();
		const results = await Promise.all(requests.map((req) => this.attemptBooking(ctx.tripId, req)));

		const finalTrip = await this.fetchTripCapacityState(ctx.tripId);
		const successful = results.filter((r) => r.success).length;
		const rejected = results.filter((r) => r.fullCapacityRejected).length;
		const delays = results.map((r) => r.latencyMs);
		const conflicts = results.filter((r) => r.conflict).length;
		const errors: Record<string, number> = {};
		for (const r of results) {
			if (r.errorCode) errors[r.errorCode] = (errors[r.errorCode] ?? 0) + 1;
		}

		const overbookingViolations = Math.max(0, finalTrip.seatsTaken - finalTrip.capacityMax);
		const allocated = finalTrip.seatsTaken - initialSeats;
		const passed = overbookingViolations === 0 && finalTrip.seatsTaken <= capacity;

		return {
			scenario: OverbookingEvaluationScenarioType.MULTI_SEAT_EDGE_CASES,
			description:
				"Evaluates concurrent multi-seat booking requests [2, 3, 4, 1] at capacity boundary. Ensures atomic group reservations never exceed capacity_max.",
			tripCapacity: finalTrip.capacityMax,
			initialSeatsTaken: initialSeats,
			finalSeatsTaken: finalTrip.seatsTaken,
			totalRequests: requests.length,
			successfulRequests: successful,
			rejectedRequests: rejected,
			overbookingViolations,
			avgLockLatencyMs: this.calculateAvg(delays),
			passed,
			details: {
				executionTimeMs: Date.now() - start,
				delays,
				conflicts,
				retries: 0,
				seatsRequested: seatSizes.reduce((a, b) => a + b, 0),
				seatsAllocated: allocated,
				errors,
			},
		};
	}

	// --------------------------------------------------------------------------
	// Scenario 5: Idempotent Concurrent Replay
	// --------------------------------------------------------------------------
	private async evaluateIdempotentConcurrentReplay(
		ctx: EvaluationContext
	): Promise<OverbookingScenarioExecutionResultDto> {
		const capacity = 5;
		await this.resetTripState(ctx.tripId, capacity, 0);

		const sharedIdempotencyKey = randomUUID();
		const sharedUserId = ctx.userIds[0];
		const requestedSeats = 2;

		// 4 concurrent requests with identical key and payload
		const requests = Array.from({ length: 4 }, () => ({
			userId: sharedUserId,
			numPeople: requestedSeats,
			idempotencyKey: sharedIdempotencyKey,
		}));

		const start = Date.now();
		const results = await Promise.all(requests.map((req) => this.attemptBooking(ctx.tripId, req)));

		const finalTrip = await this.fetchTripCapacityState(ctx.tripId);
		const successful = results.filter((r) => r.success).length;
		const rejected = results.filter((r) => r.fullCapacityRejected).length;
		const delays = results.map((r) => r.latencyMs);
		const conflicts = results.filter((r) => r.conflict).length;
		const errors: Record<string, number> = {};
		for (const r of results) {
			if (r.errorCode) errors[r.errorCode] = (errors[r.errorCode] ?? 0) + 1;
		}

		const overbookingViolations = Math.max(0, finalTrip.seatsTaken - finalTrip.capacityMax);
		// All 4 requests succeed (1 created, 3 replayed idempotently), but seats_taken is exactly 2, NOT 8!
		const passed =
			overbookingViolations === 0 &&
			finalTrip.seatsTaken === requestedSeats &&
			successful === 4 &&
			rejected === 0;

		return {
			scenario: OverbookingEvaluationScenarioType.IDEMPOTENT_CONCURRENT_REPLAY,
			description:
				"Evaluates concurrent idempotent replays with duplicate keys. Proves replay responses return successfully without double-counting seats.",
			tripCapacity: finalTrip.capacityMax,
			initialSeatsTaken: 0,
			finalSeatsTaken: finalTrip.seatsTaken,
			totalRequests: requests.length,
			successfulRequests: successful,
			rejectedRequests: rejected,
			overbookingViolations,
			avgLockLatencyMs: this.calculateAvg(delays),
			passed,
			details: {
				executionTimeMs: Date.now() - start,
				delays,
				conflicts,
				retries: 0,
				seatsRequested: requestedSeats * 4,
				seatsAllocated: finalTrip.seatsTaken,
				errors,
			},
		};
	}

	// --------------------------------------------------------------------------
	// Helper Methods & Database Fixtures
	// --------------------------------------------------------------------------
	private async attemptBooking(
		tripId: string,
		req: { userId: string; numPeople: number; idempotencyKey: string }
	): Promise<BookingAttemptResult> {
		const start = Date.now();
		try {
			await this.bookingsService.create(req.userId, req.idempotencyKey, {
				tripId,
				numPeople: req.numPeople,
			});
			return {
				success: true,
				fullCapacityRejected: false,
				conflict: false,
				isReplay: false,
				retries: 0,
				seatsRequested: req.numPeople,
				seatsAllocated: req.numPeople,
				latencyMs: Date.now() - start,
			};
		} catch (error: unknown) {
			const latencyMs = Date.now() - start;
			if (error instanceof ConflictException) {
				const message = error.message;
				if (message.includes("remaining") || message.includes("seat")) {
					return {
						success: false,
						fullCapacityRejected: true,
						conflict: false,
						isReplay: false,
						retries: 0,
						seatsRequested: req.numPeople,
						seatsAllocated: 0,
						latencyMs,
						errorCode: "FULL_CAPACITY_CONFLICT",
					};
				}
				return {
					success: false,
					fullCapacityRejected: false,
					conflict: true,
					isReplay: false,
					retries: 0,
					seatsRequested: req.numPeople,
					seatsAllocated: 0,
					latencyMs,
					errorCode: "CONFLICT_EXCEPTION",
				};
			}

			// Check for PostgreSQL serialization or constraint violation
			const err = error as { code?: string; message?: string };
			const isDbConflict = err.code === "40001" || err.code === "40P01" || err.code === "23514";
			return {
				success: false,
				fullCapacityRejected: false,
				conflict: isDbConflict,
				isReplay: false,
				retries: 0,
				seatsRequested: req.numPeople,
				seatsAllocated: 0,
				latencyMs,
				errorCode: isDbConflict ? "DB_SERIALIZATION_OR_CONSTRAINT_CONFLICT" : "UNEXPECTED_ERROR",
			};
		}
	}

	private async resolveEvaluationContext(tripId?: string): Promise<EvaluationContext> {
		const userIds = await this.resolveEvaluationUsers();

		if (tripId) {
			const rows = (await this.dataSource.query(
				`SELECT "id", "capacity_max" AS "capacityMax", "seats_taken" AS "seatsTaken", "status"
				 FROM "trips"
				 WHERE "id" = $1`,
				[tripId]
			)) as Array<{
				id: string;
				capacityMax: number | string | null;
				seatsTaken: number | string;
				status: string;
			}>;

			if (rows.length === 0) {
				throw new NotFoundException(`Trip ${tripId} not found for overbooking evaluation.`);
			}
			const row = rows[0];
			if (row.capacityMax == null) {
				throw new ConflictException(`Trip ${tripId} has no capacity_max configured.`);
			}

			return {
				tripId: row.id,
				capacityMax: Number(row.capacityMax),
				initialSeatsTaken: Number(row.seatsTaken),
				isEphemeral: false,
				userIds,
			};
		}

		// Find an existing published trip with future date and capacityMax
		const existing = (await this.dataSource.query(`
			SELECT trip."id",
			       trip."capacity_max" AS "capacityMax",
			       trip."seats_taken" AS "seatsTaken"
			FROM "trips" trip
			JOIN "trekking_routes" route ON route."id" = trip."route_id"
			WHERE trip."status" = 'published'
			  AND trip."booking_deadline" > now()
			  AND trip."starts_at" > now()
			  AND trip."capacity_max" IS NOT NULL
			  AND route."status" = 'active'
			ORDER BY trip."created_at" DESC
			LIMIT 1
		`)) as Array<{
			id: string;
			capacityMax: number | string;
			seatsTaken: number | string;
		}>;

		if (existing.length > 0) {
			const row = existing[0];
			return {
				tripId: row.id,
				capacityMax: Number(row.capacityMax),
				initialSeatsTaken: Number(row.seatsTaken),
				isEphemeral: false,
				userIds,
			};
		}

		// Otherwise provision an ephemeral evaluation trip
		const ephemeralTripId = await this.provisionEphemeralTrip(userIds[0]);
		return {
			tripId: ephemeralTripId,
			capacityMax: 10,
			initialSeatsTaken: 0,
			isEphemeral: true,
			userIds,
		};
	}

	private async resolveEvaluationUsers(): Promise<string[]> {
		const users = (await this.dataSource.query(`
			SELECT "id" FROM "users"
			WHERE "status" = 'active'
			ORDER BY "created_at" ASC
			LIMIT 20
		`)) as Array<{ id: string }>;

		if (users.length === 0) {
			throw new NotFoundException(
				"No active users found in database to execute overbooking evaluation."
			);
		}

		return users.map((u) => u.id);
	}

	private async provisionEphemeralTrip(hostId: string): Promise<string> {
		const routes = (await this.dataSource.query(`
			SELECT "id" FROM "trekking_routes"
			WHERE "status" = 'active'
			LIMIT 1
		`)) as Array<{ id: string }>;

		if (routes.length === 0) {
			throw new NotFoundException(
				"No active trekking routes found in database to provision evaluation trip."
			);
		}

		const routeId = routes[0].id;
		const tripId = randomUUID();
		const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		const endsAt = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
		const bookingDeadline = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);

		await this.dataSource.query(
			`
			INSERT INTO "trips" (
				"id", "host_id", "route_id", "title", "trip_type", "duration_nights",
				"starts_at", "ends_at", "meeting_point", "booking_deadline",
				"capacity_min", "capacity_max", "seats_taken", "price_per_person",
				"cancellation_policy", "status", "created_at", "updated_at"
			) VALUES (
				$1, $2, $3, $4, 'day_trip', 1,
				$5, $6, ST_SetSRID(ST_MakePoint(108.234567, 16.054321), 4326), $7,
				1, 10, 0, '250000.00',
				'{"refundHours": 48}'::jsonb, 'published', now(), now()
			)
			`,
			[
				tripId,
				hostId,
				routeId,
				"[EVALUATION] Overbooking Concurrency Test Trip",
				startsAt,
				endsAt,
				bookingDeadline,
			]
		);

		return tripId;
	}

	private async resetTripState(
		tripId: string,
		capacityMax: number,
		seatsTaken: number
	): Promise<void> {
		// Clean existing bookings on this trip to maintain clean scenario isolation
		await this.dataSource.query(
			`
			DELETE FROM "audit_logs"
			WHERE "target_id" IN (SELECT "id"::text FROM "bookings" WHERE "trip_id" = $1);

			DELETE FROM "booking_members"
			WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1);

			DELETE FROM "booking_items"
			WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1);

			DELETE FROM "bookings" WHERE "trip_id" = $1;

			UPDATE "trips"
			SET "capacity_max" = $2,
			    "seats_taken"  = $3,
			    "updated_at"   = now()
			WHERE "id" = $1;
			`,
			[tripId, capacityMax, seatsTaken]
		);
	}

	private async cleanupEphemeralTrip(tripId: string): Promise<void> {
		try {
			await this.dataSource.query(
				`
				DELETE FROM "audit_logs"
				WHERE "target_id" IN (SELECT "id"::text FROM "bookings" WHERE "trip_id" = $1);

				DELETE FROM "booking_members"
				WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1);

				DELETE FROM "booking_items"
				WHERE "booking_id" IN (SELECT "id" FROM "bookings" WHERE "trip_id" = $1);

				DELETE FROM "bookings" WHERE "trip_id" = $1;
				DELETE FROM "trips" WHERE "id" = $1;
				`,
				[tripId]
			);
		} catch (error) {
			this.logger.warn(`Failed to cleanup ephemeral evaluation trip ${tripId}: ${String(error)}`);
		}
	}

	private async fetchTripCapacityState(
		tripId: string
	): Promise<{ capacityMax: number; seatsTaken: number }> {
		const rows = (await this.dataSource.query(
			`SELECT "capacity_max" AS "capacityMax", "seats_taken" AS "seatsTaken"
			 FROM "trips"
			 WHERE "id" = $1`,
			[tripId]
		)) as Array<{ capacityMax: number | string; seatsTaken: number | string }>;

		if (rows.length === 0) {
			throw new NotFoundException(`Trip ${tripId} not found`);
		}

		return {
			capacityMax: Number(rows[0].capacityMax),
			seatsTaken: Number(rows[0].seatsTaken),
		};
	}

	private accumulateErrors(target: Record<string, number>, source: Record<string, number>) {
		for (const [key, value] of Object.entries(source)) {
			target[key] = (target[key] ?? 0) + value;
		}
	}

	private calculateAvg(numbers: number[]): number {
		if (numbers.length === 0) return 0;
		return Number((numbers.reduce((sum, n) => sum + n, 0) / numbers.length).toFixed(2));
	}

	private calculateP95(numbers: number[]): number {
		const sorted = [...numbers].sort((a, b) => a - b);
		const index = Math.ceil(0.95 * sorted.length) - 1;
		return Number(sorted[Math.max(0, index)].toFixed(2));
	}

	private mapToResponse(
		entity: OverbookingEvaluationReportEntity
	): OverbookingEvaluationReportResponseDto {
		return {
			id: entity.id,
			datasetVersion: entity.datasetVersion,
			configVersion: entity.configVersion,
			ruleVersion: entity.ruleVersion,
			overallResult: entity.overallResult,
			evaluatedAt: entity.evaluatedAt,
			gates: entity.gates,
			metrics: entity.metrics,
			scenarioResults: entity.scenarioResults,
			failureReasons: entity.failureReasons,
			evaluatorId: entity.evaluatorId,
			createdAt: entity.createdAt,
		};
	}
}

import type { DataSource, EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import {
	TripAutoCancelOutboxEvent,
	TripAutoCancelOutboxEventType,
} from "../entities/trip-auto-cancel-outbox-event.entity";
import { TripStatus } from "../entities/trip.entity";
import type {
	LockedTripForAutoCancelEvaluation,
	TripCancellationCommitmentSummary,
	TripsRepository,
} from "../repositories/trips.repository";
import { TripAutoCancelResult, TripAutoCancelService } from "./trip-auto-cancel.service";

const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "77777777-7777-4777-8777-777777777777";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2030-01-01T00:00:00.000Z");
const PAST_DEADLINE = new Date("2029-12-31T23:59:59.999Z");
const FUTURE_DEADLINE = new Date("2030-01-01T00:00:00.001Z");

function eligibleTrip(
	overrides: Partial<LockedTripForAutoCancelEvaluation> = {}
): LockedTripForAutoCancelEvaluation {
	return {
		id: TRIP_ID,
		status: TripStatus.PUBLISHED,
		bookingDeadline: PAST_DEADLINE,
		capacityMin: 5,
		participationEvaluatedAt: null,
		...overrides,
	};
}

function commitmentSummary(
	overrides: Partial<TripCancellationCommitmentSummary> = {}
): TripCancellationCommitmentSummary {
	return {
		bookingsCancelled: 1,
		portersUnassigned: 0,
		equipmentReservationsCancelled: 0,
		bookingRefundsCreated: 1,
		cancelledBookings: [{ id: BOOKING_ID, userId: USER_ID, totalAmount: "500000.00" }],
		...overrides,
	};
}

describe("TripAutoCancelService", () => {
	let trip: LockedTripForAutoCancelEvaluation | null;
	let confirmedParticipants: number;
	let summary: TripCancellationCommitmentSummary;
	let tripsRepository: {
		findForAutoCancelEvaluation: jest.Mock;
		countConfirmedParticipants: jest.Mock;
		markParticipationEvaluated: jest.Mock;
		cancelTripWithCommitments: jest.Mock;
		findAutoCancelCandidateIds: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let outboxRepository: { save: jest.Mock };
	let service: TripAutoCancelService;

	beforeEach(() => {
		trip = eligibleTrip();
		confirmedParticipants = 2;
		summary = commitmentSummary();
		tripsRepository = {
			findForAutoCancelEvaluation: jest.fn().mockImplementation(async () => trip),
			countConfirmedParticipants: jest.fn().mockImplementation(async () => confirmedParticipants),
			markParticipationEvaluated: jest.fn().mockResolvedValue(undefined),
			cancelTripWithCommitments: jest.fn().mockImplementation(async () => summary),
			findAutoCancelCandidateIds: jest.fn().mockResolvedValue([]),
		};
		auditRepository = { save: jest.fn().mockResolvedValue(undefined) };
		outboxRepository = { save: jest.fn().mockResolvedValue(undefined) };

		const manager = {
			query: jest.fn().mockResolvedValue([{ evaluatedAt: NOW }]),
			withRepository: jest.fn(() => tripsRepository),
			getRepository: jest.fn((entity: unknown) => {
				if (entity === AuditLog) return auditRepository;
				if (entity === TripAutoCancelOutboxEvent) return outboxRepository;
				throw new Error(`Unexpected repository: ${String(entity)}`);
			}),
		} as unknown as EntityManager;
		const dataSource = {
			transaction: jest.fn(async (callback: (transactionManager: EntityManager) => unknown) =>
				callback(manager)
			),
		} as unknown as DataSource;

		service = new TripAutoCancelService(dataSource, tripsRepository as unknown as TripsRepository);
	});

	it("cancels an eligible Trip below capacity_min, audits, and writes one outbox event per cancelled Booking", async () => {
		confirmedParticipants = 2;
		await expect(service.evaluateTrip(TRIP_ID, NOW)).resolves.toBe(TripAutoCancelResult.CANCELLED);

		expect(tripsRepository.cancelTripWithCommitments).toHaveBeenCalledWith(
			TRIP_ID,
			NOW,
			"insufficient_participants_after_deadline",
			{
				refundIdempotencyPrefix: "ctms-036",
				refundReason: "insufficient_participants_after_deadline",
			}
		);
		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: null,
				action: "trip.auto_cancelled",
				targetId: TRIP_ID,
				after: expect.objectContaining({ confirmedParticipants: 2, capacityMin: 5 }),
			})
		);
		expect(outboxRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: TripAutoCancelOutboxEventType.TRIP_AUTO_CANCELLED,
				bookingId: BOOKING_ID,
				recipientId: USER_ID,
				tripId: TRIP_ID,
				payload: expect.objectContaining({ confirmedParticipants: 2, capacityMin: 5 }),
			})
		);
	});

	it.each([
		["not published", { status: TripStatus.CANCELLED }],
		["before deadline", { bookingDeadline: FUTURE_DEADLINE }],
		["already evaluated", { participationEvaluatedAt: NOW }],
	])("does nothing when %s", async (_name, overrides) => {
		trip = eligibleTrip(overrides);
		await expect(service.evaluateTrip(TRIP_ID, NOW)).resolves.toBe(TripAutoCancelResult.NO_OP);
		expect(tripsRepository.cancelTripWithCommitments).not.toHaveBeenCalled();
		expect(tripsRepository.markParticipationEvaluated).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
		expect(outboxRepository.save).not.toHaveBeenCalled();
	});

	it("does nothing when the Trip no longer exists under lock", async () => {
		trip = null;
		await expect(service.evaluateTrip(TRIP_ID, NOW)).resolves.toBe(TripAutoCancelResult.NO_OP);
		expect(tripsRepository.cancelTripWithCommitments).not.toHaveBeenCalled();
	});

	it("marks participation evaluated without cancelling when confirmed participants meet capacity_min exactly", async () => {
		confirmedParticipants = 5;
		await expect(service.evaluateTrip(TRIP_ID, NOW)).resolves.toBe(TripAutoCancelResult.SUFFICIENT);

		expect(tripsRepository.markParticipationEvaluated).toHaveBeenCalledWith(TRIP_ID, NOW);
		expect(tripsRepository.cancelTripWithCommitments).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
		expect(outboxRepository.save).not.toHaveBeenCalled();
	});

	it("marks participation evaluated when confirmed participants exceed capacity_min", async () => {
		confirmedParticipants = 9;
		await expect(service.evaluateTrip(TRIP_ID, NOW)).resolves.toBe(TripAutoCancelResult.SUFFICIENT);
		expect(tripsRepository.cancelTripWithCommitments).not.toHaveBeenCalled();
	});

	it("does not write an outbox event when no Booking was cancelled", async () => {
		summary = commitmentSummary({ bookingsCancelled: 0, cancelledBookings: [] });
		await expect(service.evaluateTrip(TRIP_ID, NOW)).resolves.toBe(TripAutoCancelResult.CANCELLED);
		expect(auditRepository.save).toHaveBeenCalled();
		expect(outboxRepository.save).not.toHaveBeenCalled();
	});

	it("continues processing candidates after one transaction failure", async () => {
		tripsRepository.findAutoCancelCandidateIds.mockResolvedValue(["trip-1", "trip-2"]);
		const evaluate = jest
			.spyOn(service, "evaluateTrip")
			.mockRejectedValueOnce(new Error("first failed"))
			.mockResolvedValueOnce(TripAutoCancelResult.CANCELLED);

		await expect(service.autoCancelDueTrips(10)).resolves.toBeUndefined();
		expect(evaluate).toHaveBeenCalledTimes(2);
	});
});

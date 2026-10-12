import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import {
	TripAutoCancelOutboxEvent,
	TripAutoCancelOutboxEventType,
} from "../entities/trip-auto-cancel-outbox-event.entity";
import { TripStatus } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS constructor injection requires runtime metadata
import { TripsRepository } from "../repositories/trips.repository";

/** CTMS-036. Exported so other modules (e.g. RefundsService.getBookingRefundInfo,
 *  CTMS-179) can recognize a Trip cancelled by this worker specifically, distinct
 *  from a Host-triggered cancellation (CTMS-027), without hardcoding the string twice. */
export const AUTO_CANCEL_REASON = "insufficient_participants_after_deadline";
const REFUND_IDEMPOTENCY_PREFIX = "ctms-036";

export enum TripAutoCancelResult {
	CANCELLED = "cancelled",
	SUFFICIENT = "sufficient",
	NO_OP = "no_op",
}

/**
 * CTMS-036. Background evaluation for "Cancel Trip Due to Insufficient
 * Participants" (BR-107/108/109). Deliberately does NOT execute refunds --
 * it only creates the `pending` refund obligation via the same
 * `cancelTripWithCommitments` helper CTMS-027's host-cancel flow already
 * uses, and stops there. Actually moving money is CTMS-035's own job
 * (`RefundsService.processRefund`), reviewed through the existing Admin
 * refunds queue (`/admin/refunds`) -- calling it automatically from this
 * worker would have silently marked refunds "succeeded" with no real
 * provider call for any non-Camper-initiated request (see
 * `RefundsService.submitProviderRefund`, which is a stub), which is a real
 * financial-integrity risk for an unattended job. Out of Scope in the spec
 * ("Refund provider implementation beyond CTMS-035") confirms this split.
 */
@Injectable()
export class TripAutoCancelService {
	private readonly logger = new Logger(TripAutoCancelService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly tripsRepository: TripsRepository
	) {}

	async autoCancelDueTrips(batchSize: number): Promise<void> {
		const candidateIds = await this.tripsRepository.findAutoCancelCandidateIds(batchSize);
		for (const tripId of candidateIds) {
			try {
				await this.evaluateTrip(tripId);
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : "Unknown auto-cancel error";
				this.logger.error(`Failed to evaluate Trip ${tripId} for auto-cancellation: ${message}`);
			}
		}
	}

	async evaluateTrip(tripId: string, evaluatedAtOverride?: Date): Promise<TripAutoCancelResult> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const evaluatedAt = evaluatedAtOverride ?? (await this.captureDatabaseTime(manager));
			const trips = manager.withRepository(this.tripsRepository);

			const locked = await trips.findForAutoCancelEvaluation(tripId);
			if (!locked) return TripAutoCancelResult.NO_OP;

			// Re-check eligibility inside the transaction (BR-107, BR-205) -- the
			// candidate query already filtered on these, but state may have
			// changed between the batch fetch and this per-Trip lock.
			const isEligible =
				locked.status === TripStatus.PUBLISHED &&
				locked.participationEvaluatedAt === null &&
				locked.bookingDeadline.getTime() < evaluatedAt.getTime();
			if (!isEligible) return TripAutoCancelResult.NO_OP;

			const confirmedParticipants = await trips.countConfirmedParticipants(tripId);
			if (confirmedParticipants >= locked.capacityMin) {
				await trips.markParticipationEvaluated(tripId, evaluatedAt);
				return TripAutoCancelResult.SUFFICIENT;
			}

			const commitmentSummary = await trips.cancelTripWithCommitments(
				tripId,
				evaluatedAt,
				AUTO_CANCEL_REASON,
				{ refundIdempotencyPrefix: REFUND_IDEMPOTENCY_PREFIX }
			);

			await manager.getRepository(AuditLog).save({
				actorId: null,
				action: "trip.auto_cancelled",
				targetType: "trip",
				targetId: tripId,
				before: {
					status: TripStatus.PUBLISHED,
					capacityMin: locked.capacityMin,
					bookingDeadline: locked.bookingDeadline.toISOString(),
				},
				after: {
					tripId,
					evaluatedAt: evaluatedAt.toISOString(),
					status: TripStatus.CANCELLED,
					confirmedParticipants,
					capacityMin: locked.capacityMin,
					commitmentSummary,
				},
				reason: AUTO_CANCEL_REASON,
			});

			const outboxRepository = manager.getRepository(TripAutoCancelOutboxEvent);
			for (const booking of commitmentSummary.cancelledBookings) {
				await outboxRepository.save({
					eventType: TripAutoCancelOutboxEventType.TRIP_AUTO_CANCELLED,
					bookingId: booking.id,
					recipientId: booking.userId,
					tripId,
					payload: {
						tripId,
						bookingId: booking.id,
						recipientId: booking.userId,
						cancelledAt: evaluatedAt.toISOString(),
						confirmedParticipants,
						capacityMin: locked.capacityMin,
					},
				});
			}

			return TripAutoCancelResult.CANCELLED;
		});
	}

	private async captureDatabaseTime(manager: EntityManager): Promise<Date> {
		const rows = (await manager.query(`SELECT clock_timestamp() AS "evaluatedAt"`)) as Array<{
			evaluatedAt: Date;
		}>;
		const evaluatedAt = rows[0]?.evaluatedAt;
		if (!(evaluatedAt instanceof Date)) throw new Error("Database did not return evaluation time");
		return evaluatedAt;
	}
}

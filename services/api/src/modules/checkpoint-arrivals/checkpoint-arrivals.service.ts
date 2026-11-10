import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS injection metadata
import { ConfigService } from "@nestjs/config";
import { type EntityManager, QueryFailedError } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import { type Participant, participationRejection } from "../gps-tracking/gps-participant";
import type { TrackedTrip } from "../gps-tracking/gps-participation.source";
import { GpsLogRejectionReason, GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { TripStatus } from "../trips/entities/trip.entity";
import { arrivalFingerprint, arrivalIntegrityRejection } from "./checkpoint-arrival-integrity";
import type { SyncAutomaticCheckpointArrivalsDto } from "./checkpoint-arrivals.dto";
// biome-ignore lint/style/useImportType: NestJS injection metadata
import { CheckpointArrivalsRepository } from "./checkpoint-arrivals.repository";
import {
	CheckpointArrivalRejection,
	type CheckpointArrivalResult,
	CheckpointArrivalSyncStatus,
} from "./checkpoint-arrivals.types";

function extractPostgresErrorCode(error: unknown): string | null {
	if (error instanceof QueryFailedError) {
		const driver = error.driverError as { code?: string } | undefined;
		return driver?.code ?? null;
	}
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = (error as { code?: unknown }).code;
		return typeof code === "string" ? code : null;
	}
	return null;
}

function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return "unknown error";
}

function isRetryableDatabaseError(error: unknown): boolean {
	const code = extractPostgresErrorCode(error);
	if (code) {
		// 40001: serialization_failure
		// 40P01: deadlock_detected
		// 53300: too_many_connections
		if (code === "40001" || code === "40P01" || code === "53300") {
			return true;
		}
		// 08xxx: connection_exception (08000, 08003, 08006, 08001, 08004, 08007, 08P01)
		if (code.startsWith("08")) {
			return true;
		}
	}
	const message = extractErrorMessage(error);
	return /timeout|deadlock/i.test(message);
}

@Injectable()
export class CheckpointArrivalsService {
	private readonly logger = new Logger(CheckpointArrivalsService.name);

	constructor(
		private readonly repository: CheckpointArrivalsRepository,
		private readonly configService: ConfigService
	) {
		const nodeEnv = this.configService.get<string>("NODE_ENV");
		const allowFallback = this.configService.get<string>("ALLOW_CHECKPOINT_ARRIVAL_FALLBACK");
		if (nodeEnv === "production" && allowFallback === "true") {
			throw new Error("ALLOW_CHECKPOINT_ARRIVAL_FALLBACK is strictly forbidden in production");
		}
	}

	async getContext(tripId: string) {
		const context = await this.repository.findContextDirect(tripId);
		if (!context) {
			throw new NotFoundException("Active package checkpoint context is not available");
		}
		return context;
	}

	async synchronize(
		userId: string,
		tripId: string,
		dto: SyncAutomaticCheckpointArrivalsDto
	): Promise<{ results: CheckpointArrivalResult[] }> {
		const receivedBefore = Date.now();
		return this.repository.transaction(tripId, async (manager) => {
			// Keep participation stable through the commit, including late uploads after completion.
			await manager.query(
				`SELECT m.id FROM booking_members m JOIN bookings b ON b.id = m.booking_id
				WHERE b.trip_id = $1 AND m.user_id = $2 FOR SHARE OF m, b`,
				[tripId, userId]
			);
			await manager.query(
				"SELECT trip_id FROM trip_porters WHERE trip_id = $1 AND porter_id = $2 FOR SHARE",
				[tripId, userId]
			);

			const { trip, participant } = await this.resolveTripParticipant(manager, userId, tripId);

			let context = await this.repository.findContext(manager, tripId);
			if (
				!context &&
				this.configService.get<string>("ALLOW_CHECKPOINT_ARRIVAL_FALLBACK") === "true" &&
				this.configService.get<string>("NODE_ENV") !== "production"
			) {
				context = await this.repository.findOrCreateFallbackContext(manager, tripId);
			}

			if (!context) {
				throw new ConflictException("Active package checkpoint context is not available");
			}

			const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
			const isCompletedWindowExpired =
				trip.status === TripStatus.COMPLETED &&
				receivedBefore > trip.endsAt.getTime() + SEVEN_DAYS_MS;

			const results: CheckpointArrivalResult[] = [];
			for (let i = 0; i < dto.arrivals.length; i++) {
				const event = dto.arrivals[i];
				const savepointName = `arrival_sp_${i}`;
				await manager.query(`SAVEPOINT ${savepointName}`);

				const reject = (
					reason: CheckpointArrivalRejection,
					retryable = false
				): CheckpointArrivalResult => ({
					id: event.id,
					clientId: event.id,
					status: CheckpointArrivalSyncStatus.REJECTED,
					reason,
					retryable,
					visitId: null,
					receivedAt: null,
				});

				try {
					if (isCompletedWindowExpired) {
						results.push(reject(CheckpointArrivalRejection.TRIP_COMPLETED_WINDOW_EXPIRED, false));
						await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
						continue;
					}

					const integrity = arrivalIntegrityRejection(event, context);
					if (integrity) {
						results.push(reject(integrity, false));
						await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
						continue;
					}

					const fingerprint = arrivalFingerprint(event);

					// Step 1 & 2: Check UUID existence
					const existingById = await this.repository.findVisitById(manager, event.id);
					if (existingById) {
						// Rule 1: UUID belongs to other user or other trip -> rejected / id_conflict
						if (existingById.userId !== userId || existingById.tripId !== tripId) {
							results.push(reject(CheckpointArrivalRejection.ID_CONFLICT, false));
							await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
							continue;
						}
						// Rule 2a: UUID belongs to this user and fingerprint matches -> duplicate
						if (existingById.fingerprint === fingerprint) {
							results.push({
								id: event.id,
								clientId: event.id,
								status: CheckpointArrivalSyncStatus.DUPLICATE,
								reason: null,
								retryable: false,
								visitId: existingById.id,
								receivedAt: existingById.receivedAt,
							});
							await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
							continue;
						}
						// Rule 2b: UUID belongs to this user but fingerprint changed -> rejected / id_conflict
						results.push(reject(CheckpointArrivalRejection.ID_CONFLICT, false));
						await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
						continue;
					}

					// Step 3: Check triple (trip_id, user_id, checkpoint_id)
					const existingByTriple = await this.repository.findVisitByTriple(
						manager,
						tripId,
						userId,
						event.checkpointId
					);
					if (existingByTriple) {
						// Rule 3: New UUID but this checkpoint already visited -> duplicate (First-write wins!)
						results.push({
							id: event.id,
							clientId: event.id,
							status: CheckpointArrivalSyncStatus.DUPLICATE,
							reason: null,
							retryable: false,
							visitId: existingByTriple.id,
							receivedAt: existingByTriple.receivedAt,
						});
						await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
						continue;
					}

					// Participation window & clock skew validation
					const participationIssue = event.samples
						.map((sample) => participationRejection(trip, participant, sample.eventTime))
						.find(Boolean);
					const hasFutureOrInvalidSample = event.samples.some((sample) => {
						const parsed = Date.parse(sample.eventTime);
						return !Number.isFinite(parsed) || parsed > receivedBefore + 60_000;
					});

					if (participationIssue || hasFutureOrInvalidSample) {
						let issueReason: CheckpointArrivalRejection =
							CheckpointArrivalRejection.EVENT_TIME_IN_FUTURE;
						if (participationIssue) {
							switch (participationIssue) {
								case GpsLogRejectionReason.TRIP_NOT_TRACKABLE:
									issueReason = CheckpointArrivalRejection.TRIP_NOT_TRACKABLE;
									break;
								case GpsLogRejectionReason.PARTICIPATION_NOT_ELIGIBLE:
									issueReason = CheckpointArrivalRejection.PARTICIPATION_NOT_ELIGIBLE;
									break;
								case GpsLogRejectionReason.EVENT_TIME_OUTSIDE_PARTICIPATION:
									issueReason = CheckpointArrivalRejection.EVENT_TIME_OUTSIDE_PARTICIPATION;
									break;
							}
						}
						results.push(reject(issueReason, false));
						await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
						continue;
					}

					// Step 4: Clean insert -> accepted
					const inserted = await this.repository.insertVisit(
						manager,
						event,
						tripId,
						userId,
						fingerprint
					);
					if (inserted) {
						results.push({
							id: event.id,
							clientId: event.id,
							status: CheckpointArrivalSyncStatus.ACCEPTED,
							reason: null,
							retryable: false,
							visitId: inserted.id,
							receivedAt: inserted.receivedAt,
						});
					} else {
						// Concurrency race: another transaction committed between check and insert
						const stored = await this.repository.findVisitByTriple(
							manager,
							tripId,
							userId,
							event.checkpointId
						);
						if (stored) {
							results.push({
								id: event.id,
								clientId: event.id,
								status: CheckpointArrivalSyncStatus.DUPLICATE,
								reason: null,
								retryable: false,
								visitId: stored.id,
								receivedAt: stored.receivedAt,
							});
						} else {
							results.push(reject(CheckpointArrivalRejection.ID_CONFLICT, false));
						}
					}
					await manager.query(`RELEASE SAVEPOINT ${savepointName}`);
				} catch (recordError: unknown) {
					await manager.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
					const retryable = isRetryableDatabaseError(recordError);
					const errMsg = extractErrorMessage(recordError);
					if (retryable) {
						this.logger.warn(
							`Checkpoint arrival ${event.id} on trip ${tripId} failed with transient error: ${errMsg}`
						);
						results.push(reject(CheckpointArrivalRejection.PROCESSING_ERROR, true));
					} else {
						this.logger.error(
							`Checkpoint arrival ${event.id} on trip ${tripId} failed with non-retryable error: ${errMsg}`
						);
						results.push(reject(CheckpointArrivalRejection.PROCESSING_ERROR, false));
					}
				}
			}
			return { results };
		});
	}

	private async resolveTripParticipant(
		manager: EntityManager,
		userId: string,
		tripId: string
	): Promise<{ trip: TrackedTrip; participant: Participant }> {
		const trip = await this.repository.findTrackedTrip(manager, tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}
		const [camper, porter] = await Promise.all([
			this.repository.findCamperParticipation(manager, tripId, userId),
			this.repository.findPorterAssignment(manager, tripId, userId),
		]);
		const asCamper: Participant | null = camper
			? { role: GpsParticipantRole.CAMPER, camper }
			: null;
		const asPorter: Participant | null = porter
			? { role: GpsParticipantRole.PORTER, assigned: porter.assigned }
			: null;
		const participant =
			camper?.memberStatus === BookingMemberStatus.JOINED
				? asCamper
				: porter?.assigned
					? asPorter
					: (asCamper ?? asPorter);
		if (!participant) {
			throw new ForbiddenException("You are not a participant of this Trip");
		}
		return { trip, participant };
	}
}

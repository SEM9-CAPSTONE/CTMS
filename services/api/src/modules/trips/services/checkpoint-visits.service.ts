import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { ConfirmCheckpointArrivalDto } from "../dto/confirm-checkpoint-arrival.dto";
import type { SyncCheckpointArrivalsDto } from "../dto/sync-checkpoint-arrivals.dto";
import type { TripOperationalProgressResponseDto } from "../dto/trip-operational-progress-response.dto";
import { TripStatus } from "../entities/trip.entity";
// biome-ignore lint/style/useImportType: NestJS dependency injection requires runtime metadata
import {
	CheckpointVisitsRepository,
	type UpsertCheckpointVisitItem,
} from "../repositories/checkpoint-visits.repository";

const OPERATIONAL_TRIP_STATUSES = new Set<TripStatus>([
	TripStatus.PUBLISHED,
	TripStatus.ONGOING,
	TripStatus.COMPLETED,
]);

@Injectable()
export class CheckpointVisitsService {
	constructor(private readonly checkpointVisitsRepository: CheckpointVisitsRepository) {}

	async confirmCheckpointArrival(
		porterId: string,
		tripId: string,
		checkpointId: string,
		dto: ConfirmCheckpointArrivalDto
	): Promise<TripOperationalProgressResponseDto> {
		// 1. Validate Assignment (BR-234)
		const isAssigned = await this.checkpointVisitsRepository.isPorterAssignedToTrip(
			porterId,
			tripId
		);
		if (!isAssigned) {
			throw new ForbiddenException("Porter has no valid assignment for this Trip");
		}

		// 2. Validate Trip and its operational lifecycle
		const trip = await this.checkpointVisitsRepository.findTripContext(tripId);
		if (!trip) {
			throw new NotFoundException("Trip not found");
		}
		if (!OPERATIONAL_TRIP_STATUSES.has(trip.status)) {
			throw new BadRequestException(
				`Trip is in '${trip.status}' status and cannot accept checkpoint arrival updates`
			);
		}

		// 3. Validate Checkpoint belongs to the Route
		const isCheckpointValid = await this.checkpointVisitsRepository.isCheckpointOnRoute(
			checkpointId,
			trip.routeId
		);
		if (!isCheckpointValid) {
			throw new BadRequestException("Checkpoint does not belong to the Trip's Route");
		}

		// 4. Identify joined members (only joined members receive visit records per BR-234)
		const joinedMembers = await this.checkpointVisitsRepository.findJoinedMembersForTrip(tripId);
		const targetMembers = dto.memberIds
			? joinedMembers.filter((m) => dto.memberIds?.includes(m.id))
			: joinedMembers;

		// 5. Authoritative arrival time (captured offline or server time)
		const arrivedAt = dto.arrivedAt ? new Date(dto.arrivedAt) : new Date();

		// 6. Include GPS metadata when available (nullable, never fabricated)
		const location = dto.location
			? {
					type: "Point" as const,
					coordinates: dto.location.coordinates,
				}
			: null;

		// 7. Upsert checkpoint visits for applicable members
		const items: UpsertCheckpointVisitItem[] = targetMembers.map((member) => ({
			tripId,
			checkpointId,
			memberId: member.id,
			confirmedById: porterId,
			arrivedAt,
			location,
			capturedOffline: Boolean(dto.capturedOffline),
			syncId: dto.syncId ?? null,
		}));

		await this.checkpointVisitsRepository.upsertVisits(items);

		// 8. Return authoritative operational progress projection
		const progress = await this.checkpointVisitsRepository.getOperationalProgress(tripId);
		if (!progress) {
			throw new NotFoundException("Trip operational progress could not be retrieved");
		}

		return progress;
	}

	async syncCheckpointArrivals(
		porterId: string,
		tripId: string,
		dto: SyncCheckpointArrivalsDto
	): Promise<TripOperationalProgressResponseDto> {
		// Process each arrival event in sequence
		for (const arrival of dto.arrivals) {
			await this.confirmCheckpointArrival(porterId, tripId, arrival.checkpointId, arrival);
		}

		const progress = await this.checkpointVisitsRepository.getOperationalProgress(tripId);
		if (!progress) {
			throw new NotFoundException("Trip operational progress could not be retrieved");
		}

		return progress;
	}

	async getTripOperationalProgress(tripId: string): Promise<TripOperationalProgressResponseDto> {
		const progress = await this.checkpointVisitsRepository.getOperationalProgress(tripId);
		if (!progress) {
			throw new NotFoundException("Trip not found or has no Route context");
		}
		return progress;
	}
}

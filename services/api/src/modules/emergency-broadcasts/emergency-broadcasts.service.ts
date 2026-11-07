import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { EventsGateway } from "../realtime/events.gateway";
import { TripStatus } from "../trips/entities/trip.entity";
import type { CreateEmergencyBroadcastDto } from "./dto/create-emergency-broadcast.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { EmergencyBroadcastsRepository } from "./emergency-broadcasts.repository";
import type {
	BroadcastTrip,
	EmergencyBroadcast,
	EmergencyBroadcastView,
} from "./emergency-broadcasts.types";

/** Upcoming or running Trips; a broadcast to a finished, cancelled or unpublished Trip has no audience. */
const BROADCASTABLE_TRIP_STATUSES: ReadonlySet<string> = new Set([
	TripStatus.PUBLISHED,
	TripStatus.ONGOING,
]);

export enum EmergencyBroadcastErrorCode {
	TRIP_NOT_BROADCASTABLE = "TRIP_NOT_BROADCASTABLE",
	BROADCAST_ID_CONFLICT = "BROADCAST_ID_CONFLICT",
}

export interface CreateBroadcastOutcome {
	created: boolean;
	broadcast: EmergencyBroadcastView;
}

/** CTMS-081 (Jira CTMS-361): Trip-scoped emergency broadcast by the managing Host (BR-262). */
@Injectable()
export class EmergencyBroadcastsService {
	constructor(
		private readonly repository: EmergencyBroadcastsRepository,
		private readonly events: EventsGateway
	) {}

	async create(
		hostId: string,
		tripId: string,
		dto: CreateEmergencyBroadcastDto
	): Promise<CreateBroadcastOutcome> {
		const trip = await this.requireManagedTrip(hostId, tripId);
		const content = dto.content.trim();

		// AC5: a retry with the same client ID returns the stored broadcast and is not delivered again.
		const existing = await this.repository.findById(dto.id);
		if (existing)
			return {
				created: false,
				broadcast: this.sameRequestOrConflict(existing, hostId, tripId, dto.alertType, content),
			};

		if (!BROADCASTABLE_TRIP_STATUSES.has(trip.status)) {
			throw new ConflictException({
				code: EmergencyBroadcastErrorCode.TRIP_NOT_BROADCASTABLE,
				message: "Emergency broadcasts are only available for published or ongoing Trips",
			});
		}

		const result = await this.repository.create({
			id: dto.id,
			tripId,
			hostId,
			alertType: dto.alertType,
			content,
		});
		if (!result.created) {
			return {
				created: false,
				broadcast: this.sameRequestOrConflict(
					result.broadcast,
					hostId,
					tripId,
					dto.alertType,
					content
				),
			};
		}

		// Delivery only after commit, to each frozen recipient's private room plus the Host's other sessions.
		this.events.emitEmergencyBroadcast(
			[...result.recipients.map((recipient) => recipient.userId), hostId],
			{
				eventId: result.broadcast.id,
				broadcastId: result.broadcast.id,
				tripId,
				tripTitle: trip.title,
				hostId,
				alertType: result.broadcast.alertType,
				content: result.broadcast.content,
				createdAt: new Date(result.broadcast.createdAt).toISOString(),
			}
		);
		return { created: true, broadcast: this.toView(result.broadcast, true) };
	}

	async list(userId: string, tripId: string): Promise<EmergencyBroadcastView[]> {
		const trip = await this.repository.findTrip(tripId);
		if (!trip) throw new NotFoundException("Trip not found");
		if (trip.hostId === userId) {
			return (await this.repository.listForTrip(tripId)).map((b) => this.toView(b, true));
		}
		if (!(await this.repository.isTripParticipant(tripId, userId))) {
			throw new NotFoundException("Trip not found");
		}
		return (await this.repository.listForRecipient(tripId, userId)).map((b) =>
			this.toView(b, false)
		);
	}

	/** BR-262 / BR-173: outside the Host's own Trips the Trip is indistinguishable from absent. */
	private async requireManagedTrip(hostId: string, tripId: string): Promise<BroadcastTrip> {
		const trip = await this.repository.findTrip(tripId);
		if (!trip || trip.hostId !== hostId) throw new NotFoundException("Trip not found");
		return trip;
	}

	private sameRequestOrConflict(
		existing: EmergencyBroadcast,
		hostId: string,
		tripId: string,
		alertType: string,
		content: string
	): EmergencyBroadcastView {
		if (
			existing.tripId !== tripId ||
			existing.hostId !== hostId ||
			existing.alertType !== alertType ||
			existing.content !== content
		) {
			throw new ConflictException({
				code: EmergencyBroadcastErrorCode.BROADCAST_ID_CONFLICT,
				message: "This broadcast ID was already used for a different broadcast",
			});
		}
		return this.toView(existing, true);
	}

	private toView(broadcast: EmergencyBroadcast, forHost: boolean): EmergencyBroadcastView {
		return {
			id: broadcast.id,
			tripId: broadcast.tripId,
			hostId: broadcast.hostId,
			alertType: broadcast.alertType,
			content: broadcast.content,
			recipientCount: forHost ? broadcast.recipientCount : null,
			createdAt: new Date(broadcast.createdAt).toISOString(),
		};
	}
}

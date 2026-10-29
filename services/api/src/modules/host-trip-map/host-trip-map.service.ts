import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { HostTripMapQueryDto } from "./host-trip-map.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { HostTripMapRepository } from "./host-trip-map.repository";
import {
	type HostTripMap,
	LocationFreshness,
	type MapParticipant,
	type MapParticipantRow,
} from "./host-trip-map.types";

const DEFAULT_FRESHNESS_MAX_AGE_SECONDS = 120;
const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class HostTripMapService {
	private readonly maxAge: number;
	constructor(
		private readonly repository: HostTripMapRepository,
		config: ConfigService
	) {
		this.maxAge = Number(
			config.get<string>("HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS") ??
				DEFAULT_FRESHNESS_MAX_AGE_SECONDS
		);
		if (!Number.isSafeInteger(this.maxAge) || this.maxAge <= 0) {
			throw new Error("HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS must be a positive safe integer");
		}
	}

	async getMap(
		actor: AuthenticatedUser,
		query: HostTripMapQueryDto,
		tripId: string | null = null
	): Promise<HostTripMap> {
		if (actor.status !== UserStatus.ACTIVE || !actor.roles.includes(UserRole.HOST)) {
			throw new ForbiddenException("Active Host required");
		}
		const data = await this.repository.read(actor.userId, query.page, query.limit, tripId);
		const now = new Date();
		return {
			...data,
			generatedAt: now.toISOString(),
			freshnessMaxAgeSeconds: this.maxAge,
			locationSource: "server_confirmed",
			page: query.page,
			limit: query.limit,
			items: data.items.map((trip) => ({
				...trip,
				participants: trip.participants.map((p) => this.project(p, now)),
			})),
		};
	}

	async getParticipant(
		actor: AuthenticatedUser,
		tripId: string,
		role: GpsParticipantRole,
		participantId: string
	) {
		const map = await this.getMap(actor, { page: 1, limit: 1 }, tripId);
		const participant = map.items[0]?.participants.find(
			(p) => p.id === participantId && p.role === role
		);
		if (!participant) throw new NotFoundException("Active Trip participant not found");
		return {
			generatedAt: map.generatedAt,
			freshnessMaxAgeSeconds: this.maxAge,
			locationSource: map.locationSource,
			tripId,
			participant,
		};
	}

	private project(participant: MapParticipantRow, now: Date): MapParticipant {
		const location = participant.location;
		const age = location
			? (now.getTime() - Date.parse(location.eventTime)) / MILLISECONDS_PER_SECOND
			: null;
		let freshness = LocationFreshness.UNAVAILABLE;
		if (age !== null) {
			// Future-dated captures are never described as fresh.
			freshness =
				age >= 0 && age <= this.maxAge ? LocationFreshness.FRESH : LocationFreshness.STALE;
		}
		return {
			...participant,
			lastSeenAt: location?.eventTime ?? null,
			freshness,
			locationAgeSeconds: age === null ? null : Math.max(0, Math.floor(age)),
		};
	}
}

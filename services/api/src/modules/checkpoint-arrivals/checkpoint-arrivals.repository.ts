import { ConflictException, Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { BookingMemberStatus } from "../bookings/booking-member-status.enum";
import type { CamperParticipation, TrackedTrip } from "../gps-tracking/gps-participation.source";
import { BookingStatus } from "../profiles/entities/booking.entity";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { CheckpointArrivalInputDto } from "./checkpoint-arrivals.dto";
import type { CheckpointArrivalContext } from "./checkpoint-arrivals.types";

export interface StoredAutomaticVisit {
	id: string;
	tripId: string;
	userId: string;
	fingerprint: string;
	receivedAt: Date;
}

@Injectable()
export class CheckpointArrivalsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async transaction<T>(tripId: string, work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(async (manager) => {
			// Also serializes first-context registration and visits for this Trip.
			await manager.query("SELECT id FROM trips WHERE id = $1 FOR UPDATE", [tripId]);
			return work(manager);
		});
	}

	/** Internal package-publisher seam. Never accepts client manifests or hot-swaps a Trip. */
	async registerActivePackage(context: CheckpointArrivalContext): Promise<void> {
		await this.transaction(context.tripId, async (manager) => {
			const matching = (await manager.query(
				`SELECT t.id FROM trips t WHERE t.id = $1 AND t.route_id = $2
				 AND t.status IN ('published', 'ongoing')`,
				[context.tripId, context.routeId]
			)) as Array<{ id: string }>;
			if (
				!matching.length ||
				!context.routeVersion.trim() ||
				!context.packageVersion.trim() ||
				context.routeVersion.length > 64 ||
				context.packageVersion.length > 64
			) {
				throw new ConflictException("Invalid active package Route/Trip context");
			}
			const existing = await this.findContext(manager, context.tripId);
			if (existing) {
				if (
					existing.routeId !== context.routeId ||
					existing.routeVersion !== context.routeVersion ||
					existing.packageId !== context.packageId ||
					existing.packageVersion !== context.packageVersion ||
					JSON.stringify(
						[...existing.checkpoints]
							.sort((a, b) => a.id.localeCompare(b.id))
							.map((cp) => [cp.id, cp.latitude, cp.longitude])
					) !==
						JSON.stringify(
							[...context.checkpoints]
								.sort((a, b) => a.id.localeCompare(b.id))
								.map((cp) => [cp.id, cp.latitude, cp.longitude])
						)
				) {
					throw new ConflictException("Active checkpoint package cannot be replaced");
				}
				return;
			}
			const checkpoints = (await manager.query(
				`SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude
				 FROM checkpoints WHERE route_id = $1 FOR SHARE`,
				[context.routeId]
			)) as CheckpointArrivalContext["checkpoints"];
			if (
				new Set(context.checkpoints.map((cp) => cp.id)).size !== context.checkpoints.length ||
				context.checkpoints.some(
					(cp) =>
						!checkpoints.some(
							(stored) =>
								stored.id === cp.id &&
								stored.latitude === cp.latitude &&
								stored.longitude === cp.longitude
						)
				)
			) {
				throw new ConflictException("Package must contain authoritative Route checkpoints");
			}
			await manager.query(
				`INSERT INTO checkpoint_arrival_contexts
				 (trip_id, route_id, route_version, package_id, package_version, checkpoints, context_source)
				 VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'authoritative')`,
				[
					context.tripId,
					context.routeId,
					context.routeVersion,
					context.packageId,
					context.packageVersion,
					JSON.stringify(context.checkpoints),
				]
			);
		});
	}

	async findContext(
		manager: EntityManager,
		tripId: string
	): Promise<CheckpointArrivalContext | null> {
		const rows = (await manager.query(
			`SELECT trip_id AS "tripId", route_id AS "routeId", route_version AS "routeVersion",
			 package_id AS "packageId", package_version AS "packageVersion", checkpoints,
			 context_source AS "contextSource"
			 FROM checkpoint_arrival_contexts c
			 WHERE trip_id = $1 AND EXISTS (SELECT 1 FROM trips t WHERE t.id = c.trip_id AND t.route_id = c.route_id)`,
			[tripId]
		)) as CheckpointArrivalContext[];
		return rows[0] ?? null;
	}

	async findVisitById(manager: EntityManager, id: string): Promise<StoredAutomaticVisit | null> {
		const rows = (await manager.query(
			`SELECT id, trip_id AS "tripId", user_id AS "userId", fingerprint, received_at AS "receivedAt"
			 FROM automatic_checkpoint_visits WHERE id = $1 LIMIT 1`,
			[id]
		)) as StoredAutomaticVisit[];
		return rows[0] ?? null;
	}

	async findVisitByTriple(
		manager: EntityManager,
		tripId: string,
		userId: string,
		checkpointId: string
	): Promise<StoredAutomaticVisit | null> {
		const rows = (await manager.query(
			`SELECT id, trip_id AS "tripId", user_id AS "userId", fingerprint, received_at AS "receivedAt"
			 FROM automatic_checkpoint_visits
			 WHERE trip_id = $1 AND user_id = $2 AND checkpoint_id = $3 LIMIT 1`,
			[tripId, userId, checkpointId]
		)) as StoredAutomaticVisit[];
		return rows[0] ?? null;
	}

	async findOrCreateFallbackContext(
		manager: EntityManager,
		tripId: string
	): Promise<CheckpointArrivalContext | null> {
		const existing = await this.findContext(manager, tripId);
		if (existing) return existing;

		const rows = (await manager.query(
			`SELECT t.id AS "tripId", t.route_id AS "routeId", 'v1' AS "routeVersion",
			        t.id AS "packageId", 'v1-dev' AS "packageVersion",
			        COALESCE(
			            jsonb_agg(
			                jsonb_build_object(
			                    'id', cp.id,
			                    'latitude', ST_Y(cp.location::geometry),
			                    'longitude', ST_X(cp.location::geometry)
			                )
			            ) FILTER (WHERE cp.id IS NOT NULL),
			            '[]'::jsonb
			        ) AS checkpoints
			 FROM trips t
			 JOIN trekking_routes r ON r.id = t.route_id
			 LEFT JOIN checkpoints cp ON cp.route_id = t.route_id
			 WHERE t.id = $1 AND t.status IN ('published', 'ongoing', 'completed')
			 GROUP BY t.id, t.route_id`,
			[tripId]
		)) as Array<{
			tripId: string;
			routeId: string;
			routeVersion: string;
			packageId: string;
			packageVersion: string;
			checkpoints: CheckpointArrivalContext["checkpoints"];
		}>;
		if (!rows.length || !rows[0].checkpoints || rows[0].checkpoints.length === 0) return null;

		const fallback = rows[0];
		await manager.query(
			`INSERT INTO checkpoint_arrival_contexts
			 (trip_id, route_id, route_version, package_id, package_version, checkpoints, context_source)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'fallback')
			 ON CONFLICT (trip_id) DO NOTHING`,
			[
				fallback.tripId,
				fallback.routeId,
				fallback.routeVersion,
				fallback.packageId,
				fallback.packageVersion,
				JSON.stringify(fallback.checkpoints),
			]
		);

		return {
			...fallback,
			contextSource: "fallback",
		};
	}

	async findTrackedTrip(manager: EntityManager, tripId: string): Promise<TrackedTrip | null> {
		const rows = (await manager.query(
			`SELECT "id", "host_id" AS "hostId", "status", "starts_at" AS "startsAt", "ends_at" AS "endsAt", "updated_at" AS "updatedAt"
			 FROM "trips" WHERE "id" = $1`,
			[tripId]
		)) as TrackedTrip[];
		return rows[0] ?? null;
	}

	async findCamperParticipation(
		manager: EntityManager,
		tripId: string,
		userId: string
	): Promise<CamperParticipation | null> {
		const rows = (await manager.query(
			`SELECT member."member_status" AS "memberStatus",
			        member."checked_in_at" AS "checkedInAt",
			        member."left_at" AS "leftAt"
			 FROM "booking_members" member
			 INNER JOIN "bookings" booking ON booking."id" = member."booking_id"
			 WHERE booking."trip_id" = $1
			   AND member."user_id" = $2
			   AND booking."status" = ANY($3::booking_status[])
			 ORDER BY (member."member_status" = $4) DESC, member."created_at" ASC
			 LIMIT 1`,
			[
				tripId,
				userId,
				[BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
				BookingMemberStatus.JOINED,
			]
		)) as CamperParticipation[];
		return rows[0] ?? null;
	}

	async findPorterAssignment(
		manager: EntityManager,
		tripId: string,
		userId: string
	): Promise<{ assigned: boolean } | null> {
		const rows = (await manager.query(
			`SELECT "status" FROM "trip_porters" WHERE "trip_id" = $1 AND "porter_id" = $2`,
			[tripId, userId]
		)) as Array<{ status: TripPorterStatus }>;
		if (rows.length === 0) {
			return null;
		}
		return { assigned: rows[0].status === TripPorterStatus.ASSIGNED };
	}

	async findVisit(
		manager: EntityManager,
		event: CheckpointArrivalInputDto,
		tripId: string,
		userId: string
	): Promise<StoredAutomaticVisit | null> {
		const rows = (await manager.query(
			`SELECT id, trip_id AS "tripId", user_id AS "userId", fingerprint, received_at AS "receivedAt"
			 FROM automatic_checkpoint_visits WHERE id = $1
			 OR (trip_id = $2 AND user_id = $3 AND checkpoint_id = $4)
			 ORDER BY (id = $1) DESC LIMIT 1`,
			[event.id, tripId, userId, event.checkpointId]
		)) as StoredAutomaticVisit[];
		return rows[0] ?? null;
	}

	async insertVisit(
		manager: EntityManager,
		event: CheckpointArrivalInputDto,
		tripId: string,
		userId: string,
		fingerprint: string
	): Promise<StoredAutomaticVisit | null> {
		const sample = event.samples[event.samples.length - 1];
		const rows = (await manager.query(
			`INSERT INTO automatic_checkpoint_visits
			 (id, trip_id, user_id, checkpoint_id, route_id, route_version, package_id,
			 package_version, event_time, location, samples, detected_offline, fingerprint)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
			 ST_SetSRID(ST_MakePoint($10,$11),4326)::geography,$12::jsonb,$13,$14)
			 ON CONFLICT DO NOTHING
			 RETURNING id, trip_id AS "tripId", user_id AS "userId", fingerprint, received_at AS "receivedAt"`,
			[
				event.id,
				tripId,
				userId,
				event.checkpointId,
				event.routeId,
				event.routeVersion,
				event.packageId,
				event.packageVersion,
				sample.eventTime,
				sample.longitude,
				sample.latitude,
				JSON.stringify(event.samples),
				event.detectedOffline,
				fingerprint,
			]
		)) as StoredAutomaticVisit[];
		const visit = rows[0];
		if (!visit) return null;
		await this.insertAuditLog(manager, userId, event, tripId);
		return visit;
	}

	async insertAuditLog(
		manager: EntityManager,
		userId: string,
		event: CheckpointArrivalInputDto,
		tripId: string
	): Promise<void> {
		const sample = event.samples[event.samples.length - 1];
		await manager.query(
			`INSERT INTO audit_logs (actor_id, action, target_type, target_id, after, reason)
			 VALUES ($1, 'checkpoint_arrival.received', 'automatic_checkpoint_visit', $2, $3::jsonb,
			 'automatic_checkpoint_sync')`,
			[
				userId,
				event.id,
				JSON.stringify({
					tripId,
					checkpointId: event.checkpointId,
					routeId: event.routeId,
					packageId: event.packageId,
					packageVersion: event.packageVersion,
					routeVersion: event.routeVersion,
					eventTime: sample.eventTime,
				}),
			]
		);
	}
}

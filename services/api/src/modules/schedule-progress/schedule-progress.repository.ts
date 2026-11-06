import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI
import { DataSource } from "typeorm";
import {
	CHECKPOINT_PASS_RADIUS_METERS,
	ROUTE_CORRIDOR_METERS,
	SCHEDULE_PROGRESS_CONFIG_VERSION,
	VALID_SAMPLE_MAX_ACCURACY_METERS,
} from "./schedule-progress.constants";
import type {
	BehindScheduleLevel,
	LastValidSample,
	RouteCheckpoint,
} from "./schedule-progress.evaluator";

export interface ScheduleTrip {
	id: string;
	hostId: string;
	status: string;
	routeId: string;
	/** md5 of the Route geometry, as CTMS-060 `routeVersion`. */
	routeVersion: string;
}

export interface TripCamper {
	userId: string;
	fullName: string | null;
}

export interface NewBehindScheduleWarning {
	tripId: string;
	userId: string;
	checkpointId: string;
	level: BehindScheduleLevel;
	eventTime: Date;
	routeId: string;
	routeVersion: string;
	sample: LastValidSample | null;
}

/** Bookings whose members are Trip participants (same set as CTMS-059 participation). */
const PARTICIPATING_BOOKING_STATUSES = ["confirmed", "completed"];

/**
 * CTMS-063 §13.7: read-only access to Porter baselines, Camper GPS and Route checkpoints, plus the
 * idempotent store for raised warnings. `checkpoint_visits` is read only for the Porter baseline —
 * its per-member rows are never treated as Camper evidence (§13.2).
 */
@Injectable()
export class ScheduleProgressRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findTrip(tripId: string): Promise<ScheduleTrip | null> {
		const rows = (await this.dataSource.query(
			`SELECT trip."id", trip."host_id" AS "hostId", trip."status",
			        route."id" AS "routeId", md5(ST_AsBinary(route."route_geom")) AS "routeVersion"
			 FROM "trips" trip
			 INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			 WHERE trip."id" = $1`,
			[tripId]
		)) as ScheduleTrip[];
		return rows[0] ?? null;
	}

	async findCheckpoints(routeId: string): Promise<RouteCheckpoint[]> {
		const rows = (await this.dataSource.query(
			`SELECT checkpoint."id", checkpoint."name", checkpoint."type"::text AS "type",
			        checkpoint."nearby_water_or_shelter" AS "nearbyWaterOrShelter",
			        ST_LineLocatePoint(route."route_geom"::geometry, checkpoint."location"::geometry)
			          AS "routeFraction",
			        ST_Y(checkpoint."location"::geometry) AS "latitude",
			        ST_X(checkpoint."location"::geometry) AS "longitude"
			 FROM "checkpoints" checkpoint
			 INNER JOIN "trekking_routes" route ON route."id" = checkpoint."route_id"
			 WHERE checkpoint."route_id" = $1`,
			[routeId]
		)) as RouteCheckpoint[];
		return rows.map((row) => ({ ...row, routeFraction: Number(row.routeFraction) }));
	}

	/** T(X): earliest Porter confirmation per Checkpoint of the Trip (CTMS-056). */
	async findPorterBaselines(tripId: string): Promise<Map<string, Date>> {
		const rows = (await this.dataSource.query(
			`SELECT "checkpoint_id" AS "checkpointId", MIN("arrived_at") AS "arrivedAt"
			 FROM "checkpoint_visits" WHERE "trip_id" = $1
			 GROUP BY "checkpoint_id"`,
			[tripId]
		)) as Array<{ checkpointId: string; arrivedAt: Date }>;
		return new Map(rows.map((row) => [row.checkpointId, new Date(row.arrivedAt)]));
	}

	/** Campers currently on the Trip: joined members of participating Bookings. */
	async findJoinedCampers(tripId: string): Promise<TripCamper[]> {
		return (await this.dataSource.query(
			`SELECT DISTINCT member."user_id" AS "userId", account."full_name" AS "fullName"
			 FROM "booking_members" member
			 INNER JOIN "bookings" booking ON booking."id" = member."booking_id"
			 INNER JOIN "users" account ON account."id" = member."user_id"
			 WHERE booking."trip_id" = $1
			   AND booking."status"::text = ANY($2)
			   AND member."member_status"::text = 'joined'
			   AND member."user_id" IS NOT NULL
			 ORDER BY member."user_id"`,
			[tripId, PARTICIPATING_BOOKING_STATUSES]
		)) as TripCamper[];
	}

	/**
	 * §13.2 "Camper passed X", from the Camper's own VALID samples only: within 20 m of X, or inside
	 * the 50 m on-route corridor and further along the Route than X. Samples before T(X) count too.
	 */
	async findPassedCheckpoints(
		tripId: string,
		routeId: string,
		userIds: string[],
		checkpointIds: string[]
	): Promise<Map<string, Set<string>>> {
		const passed = new Map<string, Set<string>>();
		if (userIds.length === 0 || checkpointIds.length === 0) return passed;
		const rows = (await this.dataSource.query(
			`SELECT DISTINCT sample."user_id" AS "userId", checkpoint."id" AS "checkpointId"
			 FROM "gps_logs" sample
			 INNER JOIN "trekking_routes" route ON route."id" = $2
			 INNER JOIN "checkpoints" checkpoint ON checkpoint."id" = ANY($4::uuid[])
			 WHERE sample."trip_id" = $1
			   AND sample."participant_role"::text = 'camper'
			   AND sample."user_id" = ANY($3::uuid[])
			   AND sample."accuracy_meters" <= $5
			   AND (
			     ST_DWithin(sample."location", checkpoint."location", $6)
			     OR (
			       ST_DWithin(sample."location", route."route_geom", $7)
			       AND ST_LineLocatePoint(route."route_geom"::geometry, sample."location"::geometry)
			         > ST_LineLocatePoint(route."route_geom"::geometry, checkpoint."location"::geometry)
			     )
			   )`,
			[
				tripId,
				routeId,
				userIds,
				checkpointIds,
				VALID_SAMPLE_MAX_ACCURACY_METERS,
				CHECKPOINT_PASS_RADIUS_METERS,
				ROUTE_CORRIDOR_METERS,
			]
		)) as Array<{ userId: string; checkpointId: string }>;
		for (const row of rows) {
			const set = passed.get(row.userId) ?? new Set<string>();
			set.add(row.checkpointId);
			passed.set(row.userId, set);
		}
		return passed;
	}

	/** Latest VALID Camper sample, with its Route fraction only when inside the on-route corridor. */
	async findLastValidSamples(
		tripId: string,
		routeId: string,
		userIds: string[]
	): Promise<Map<string, LastValidSample>> {
		if (userIds.length === 0) return new Map();
		const rows = (await this.dataSource.query(
			`SELECT DISTINCT ON (sample."user_id")
			        sample."user_id" AS "userId", sample."event_time" AS "eventTime",
			        ST_Y(sample."location"::geometry) AS "latitude",
			        ST_X(sample."location"::geometry) AS "longitude",
			        sample."accuracy_meters" AS "accuracyMeters",
			        CASE WHEN ST_DWithin(sample."location", route."route_geom", $5)
			             THEN ST_LineLocatePoint(route."route_geom"::geometry, sample."location"::geometry)
			        END AS "routeFraction"
			 FROM "gps_logs" sample
			 INNER JOIN "trekking_routes" route ON route."id" = $2
			 WHERE sample."trip_id" = $1
			   AND sample."participant_role"::text = 'camper'
			   AND sample."user_id" = ANY($3::uuid[])
			   AND sample."accuracy_meters" <= $4
			 ORDER BY sample."user_id", sample."event_time" DESC, sample."id" DESC`,
			[tripId, routeId, userIds, VALID_SAMPLE_MAX_ACCURACY_METERS, ROUTE_CORRIDOR_METERS]
		)) as Array<LastValidSample & { userId: string }>;
		return new Map(
			rows.map(({ userId, ...sample }) => [
				userId,
				{
					...sample,
					eventTime: new Date(sample.eventTime),
					routeFraction: sample.routeFraction === null ? null : Number(sample.routeFraction),
				},
			])
		);
	}

	/**
	 * §13.3/§13.7: one `BEHIND_SCHEDULE` row per (trip, camper, checkpoint, level). Re-evaluation and
	 * concurrent requests hit the partial unique index and change nothing.
	 */
	async recordWarnings(warnings: NewBehindScheduleWarning[]): Promise<void> {
		if (warnings.length === 0) return;
		const payload = warnings.map((warning) => ({
			trip_id: warning.tripId,
			user_id: warning.userId,
			checkpoint_id: warning.checkpointId,
			warning_level: warning.level,
			event_time: warning.eventTime.toISOString(),
			route_id: warning.routeId,
			route_version: warning.routeVersion,
			latitude: warning.sample?.latitude ?? null,
			longitude: warning.sample?.longitude ?? null,
			accuracy_meters: warning.sample?.accuracyMeters ?? null,
		}));
		await this.dataSource.query(
			`INSERT INTO "safety_events" (
			   "id", "trip_id", "user_id", "participant_role", "event_type", "event_time",
			   "location", "accuracy_meters", "detected_offline", "route_id", "route_version",
			   "config_version", "received_at", "checkpoint_id", "warning_level"
			 )
			 SELECT gen_random_uuid(), item."trip_id", item."user_id", 'camper', 'BEHIND_SCHEDULE',
			        item."event_time",
			        CASE WHEN item."latitude" IS NULL THEN NULL
			             ELSE ST_SetSRID(ST_MakePoint(item."longitude", item."latitude"), 4326)::geography END,
			        item."accuracy_meters", false, item."route_id", item."route_version", $2, now(),
			        item."checkpoint_id", item."warning_level"
			 FROM jsonb_to_recordset($1::jsonb) AS item(
			   "trip_id" uuid, "user_id" uuid, "checkpoint_id" uuid,
			   "warning_level" "behind_schedule_level", "event_time" timestamptz, "route_id" uuid,
			   "route_version" varchar, "latitude" double precision, "longitude" double precision,
			   "accuracy_meters" double precision
			 )
			 ON CONFLICT ("trip_id", "user_id", "checkpoint_id", "warning_level")
			   WHERE "checkpoint_id" IS NOT NULL
			 DO NOTHING`,
			[JSON.stringify(payload), SCHEDULE_PROGRESS_CONFIG_VERSION]
		);
	}
}

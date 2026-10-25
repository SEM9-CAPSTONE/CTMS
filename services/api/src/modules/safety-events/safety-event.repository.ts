import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { GpsParticipantRole } from "../gps-tracking/gps-tracking.enums";
import type { GeoLineString } from "../trekking-routes/entities/trekking-route.entity";
import type { SafetyEventType } from "./safety-events.enums";

export interface TripRoute {
	routeId: string;
	/** md5 of the Route geometry: Routes referenced by Trips cannot be edited in place. */
	routeVersion: string;
	geometry: GeoLineString;
}

export interface NewSafetyEvent {
	id: string;
	tripId: string;
	userId: string;
	participantRole: GpsParticipantRole;
	eventType: SafetyEventType;
	eventTime: string;
	latitude: number | null;
	longitude: number | null;
	accuracyMeters: number | null;
	distanceToRouteMeters: number | null;
	consecutiveValidSamples: number | null;
	noValidSampleSince: string | null;
	detectedOffline: boolean;
	routeId: string;
	routeVersion: string;
	packageVersion: string | null;
	configVersion: string;
}

export interface SafetyEventOwner {
	id: string;
	tripId: string;
	userId: string;
}

@Injectable()
export class SafetyEventRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findTripRoute(tripId: string): Promise<TripRoute | null> {
		const rows = (await this.dataSource.query(
			`SELECT route."id" AS "routeId",
			        md5(ST_AsBinary(route."route_geom")) AS "routeVersion",
			        ST_AsGeoJSON(route."route_geom"::geometry)::json AS "geometry"
			 FROM "trips" trip
			 INNER JOIN "trekking_routes" route ON route."id" = trip."route_id"
			 WHERE trip."id" = $1`,
			[tripId]
		)) as TripRoute[];
		return rows[0] ?? null;
	}

	/**
	 * Inserts all events and their audit entries in one statement and returns the ids
	 * actually created. `ON CONFLICT DO NOTHING` makes a repeated or concurrent upload of
	 * the same UUID a no-op that keeps the first stored context (BR-244), and only newly
	 * created events are audited.
	 */
	async insertIgnoringExisting(events: NewSafetyEvent[]): Promise<Set<string>> {
		if (events.length === 0) {
			return new Set();
		}
		const rows = (await this.dataSource.query(
			`WITH inserted AS (
				INSERT INTO "safety_events" (
					"id", "trip_id", "user_id", "participant_role", "event_type", "event_time", "location",
					"accuracy_meters", "distance_to_route_meters", "consecutive_valid_samples",
					"no_valid_sample_since", "detected_offline", "route_id", "route_version",
					"package_version", "config_version"
				)
				SELECT event."id", event."trip_id", event."user_id",
				       event."participant_role"::gps_participant_role,
				       event."event_type"::safety_event_type, event."event_time",
				       CASE WHEN event."latitude" IS NULL THEN NULL
				            ELSE ST_SetSRID(ST_MakePoint(event."longitude", event."latitude"), 4326)::geography
				       END,
				       event."accuracy_meters", event."distance_to_route_meters",
				       event."consecutive_valid_samples", event."no_valid_sample_since",
				       event."detected_offline", event."route_id", event."route_version",
				       event."package_version", event."config_version"
				FROM jsonb_to_recordset($1::jsonb) AS event(
					"id" uuid, "trip_id" uuid, "user_id" uuid, "participant_role" text, "event_type" text,
					"event_time" timestamptz, "latitude" double precision, "longitude" double precision,
					"accuracy_meters" double precision, "distance_to_route_meters" double precision,
					"consecutive_valid_samples" smallint, "no_valid_sample_since" timestamptz,
					"detected_offline" boolean, "route_id" uuid, "route_version" varchar,
					"package_version" varchar, "config_version" varchar
				)
				ON CONFLICT ("id") DO NOTHING
				RETURNING "id", "trip_id", "user_id", "event_type", "event_time", "route_id",
				          "route_version", "package_version", "detected_offline"
			),
			audited AS (
				INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "after", "reason")
				SELECT inserted."user_id", 'safety_event.received', 'safety_event', inserted."id",
				       jsonb_build_object(
				         'tripId', inserted."trip_id", 'eventType', inserted."event_type",
				         'eventTime', inserted."event_time", 'routeId', inserted."route_id",
				         'routeVersion', inserted."route_version",
				         'packageVersion', inserted."package_version",
				         'detectedOffline', inserted."detected_offline"
				       ),
				       'client_safety_event_sync'
				FROM inserted
			)
			SELECT "id" FROM inserted`,
			[
				JSON.stringify(
					events.map((event) => ({
						id: event.id,
						trip_id: event.tripId,
						user_id: event.userId,
						participant_role: event.participantRole,
						event_type: event.eventType,
						event_time: event.eventTime,
						latitude: event.latitude,
						longitude: event.longitude,
						accuracy_meters: event.accuracyMeters,
						distance_to_route_meters: event.distanceToRouteMeters,
						consecutive_valid_samples: event.consecutiveValidSamples,
						no_valid_sample_since: event.noValidSampleSince,
						detected_offline: event.detectedOffline,
						route_id: event.routeId,
						route_version: event.routeVersion,
						package_version: event.packageVersion,
						config_version: event.configVersion,
					}))
				),
			]
		)) as Array<{ id: string }>;
		return new Set(rows.map((row) => row.id));
	}

	async findOwners(ids: string[]): Promise<Map<string, SafetyEventOwner>> {
		if (ids.length === 0) {
			return new Map();
		}
		const rows = (await this.dataSource.query(
			`SELECT "id", "trip_id" AS "tripId", "user_id" AS "userId"
			 FROM "safety_events" WHERE "id" = ANY($1::uuid[])`,
			[ids]
		)) as SafetyEventOwner[];
		return new Map(rows.map((row) => [row.id, row]));
	}
}

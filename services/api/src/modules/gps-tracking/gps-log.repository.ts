import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { GpsParticipantRole } from "./gps-tracking.enums";

export interface NewGpsLog {
	id: string;
	tripId: string;
	userId: string;
	participantRole: GpsParticipantRole;
	eventTime: string;
	latitude: number;
	longitude: number;
	accuracyMeters: number;
	altitudeMeters: number | null;
	batteryLevel: number | null;
	packageVersion: string | null;
	configVersion: string;
}

export interface GpsLogOwner {
	id: string;
	tripId: string;
	userId: string;
}

@Injectable()
export class GpsLogRepository {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Inserts all logs in one statement and returns the ids actually created.
	 * `ON CONFLICT DO NOTHING` makes a repeated or concurrent upload of the same
	 * UUID a no-op instead of a duplicate row or an error (BR-244).
	 */
	async insertIgnoringExisting(logs: NewGpsLog[]): Promise<Set<string>> {
		if (logs.length === 0) {
			return new Set();
		}
		const rows = (await this.dataSource.query(
			`INSERT INTO "gps_logs" (
				"id", "trip_id", "user_id", "participant_role", "event_time", "location",
				"accuracy_meters", "altitude_meters", "battery_level", "package_version", "config_version"
			 )
			 SELECT log."id", log."trip_id", log."user_id", log."participant_role"::gps_participant_role,
			        log."event_time",
			        ST_SetSRID(ST_MakePoint(log."longitude", log."latitude"), 4326)::geography,
			        log."accuracy_meters", log."altitude_meters", log."battery_level",
			        log."package_version", log."config_version"
			 FROM jsonb_to_recordset($1::jsonb) AS log(
				"id" uuid, "trip_id" uuid, "user_id" uuid, "participant_role" text,
				"event_time" timestamptz, "latitude" double precision, "longitude" double precision,
				"accuracy_meters" double precision, "altitude_meters" double precision,
				"battery_level" smallint, "package_version" varchar, "config_version" varchar
			 )
			 ON CONFLICT ("id") DO NOTHING
			 RETURNING "id"`,
			[
				JSON.stringify(
					logs.map((log) => ({
						id: log.id,
						trip_id: log.tripId,
						user_id: log.userId,
						participant_role: log.participantRole,
						event_time: log.eventTime,
						latitude: log.latitude,
						longitude: log.longitude,
						accuracy_meters: log.accuracyMeters,
						altitude_meters: log.altitudeMeters,
						battery_level: log.batteryLevel,
						package_version: log.packageVersion,
						config_version: log.configVersion,
					}))
				),
			]
		)) as Array<{ id: string }>;
		return new Set(rows.map((row) => row.id));
	}

	async findOwners(ids: string[]): Promise<Map<string, GpsLogOwner>> {
		if (ids.length === 0) {
			return new Map();
		}
		const rows = (await this.dataSource.query(
			`SELECT "id", "trip_id" AS "tripId", "user_id" AS "userId"
			 FROM "gps_logs" WHERE "id" = ANY($1::uuid[])`,
			[ids]
		)) as GpsLogOwner[];
		return new Map(rows.map((row) => [row.id, row]));
	}
}

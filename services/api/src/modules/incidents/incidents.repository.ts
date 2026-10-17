import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { TripStatus } from "../trips/entities/trip.entity";
import type {
	IncidentCategory,
	IncidentLocationStatus,
	IncidentSeverity,
	IncidentStatus,
} from "./incidents.enums";

export interface IncidentTrip {
	id: string;
	hostId: string;
	status: TripStatus;
	startsAt: Date;
	endsAt: Date;
}

export interface NewIncident {
	id: string;
	tripId: string;
	reporterId: string;
	category: IncidentCategory;
	severity: IncidentSeverity;
	description: string;
	occurredAt: string;
	latitude: number | null;
	longitude: number | null;
	locationAccuracyMeters: number | null;
	locationCapturedAt: string | null;
	locationStatus: IncidentLocationStatus;
	capturedOffline: boolean;
}

export interface IncidentMedia {
	url: string;
	contentType: string;
	sizeBytes: number;
}

export interface IncidentRow {
	id: string;
	tripId: string;
	reporterId: string;
	reporterName: string | null;
	category: IncidentCategory;
	severity: IncidentSeverity;
	status: IncidentStatus;
	description: string;
	occurredAt: Date;
	latitude: number | null;
	longitude: number | null;
	locationAccuracyMeters: number | null;
	locationCapturedAt: Date | null;
	locationStatus: IncidentLocationStatus;
	capturedOffline: boolean;
	mediaUrl: string | null;
	mediaContentType: string | null;
	mediaSizeBytes: number | null;
	mediaUploadedAt: Date | null;
	receivedAt: Date;
}

const INCIDENT_AUDIT_ACTION = "incident.report";
const INCIDENT_MEDIA_AUDIT_ACTION = "incident.media.attach";
const INCIDENT_AUDIT_TARGET = "trip_incident";

const INCIDENT_SELECT = `
	SELECT incident."id", incident."trip_id" AS "tripId", incident."reporter_id" AS "reporterId",
	       reporter."full_name" AS "reporterName", incident."category", incident."severity",
	       incident."status", incident."description", incident."occurred_at" AS "occurredAt",
	       ST_Y(incident."location"::geometry) AS "latitude",
	       ST_X(incident."location"::geometry) AS "longitude",
	       incident."location_accuracy_meters" AS "locationAccuracyMeters",
	       incident."location_captured_at" AS "locationCapturedAt",
	       incident."location_status" AS "locationStatus",
	       incident."captured_offline" AS "capturedOffline",
	       incident."media_url" AS "mediaUrl", incident."media_content_type" AS "mediaContentType",
	       incident."media_size_bytes" AS "mediaSizeBytes",
	       incident."media_uploaded_at" AS "mediaUploadedAt",
	       incident."received_at" AS "receivedAt"
	FROM "trip_incidents" incident
	LEFT JOIN "users" reporter ON reporter."id" = incident."reporter_id"`;

@Injectable()
export class IncidentsRepository {
	constructor(private readonly dataSource: DataSource) {}

	async findTrip(tripId: string): Promise<IncidentTrip | null> {
		const rows = (await this.dataSource.query(
			`SELECT "id", "host_id" AS "hostId", "status", "starts_at" AS "startsAt", "ends_at" AS "endsAt"
			 FROM "trips" WHERE "id" = $1`,
			[tripId]
		)) as IncidentTrip[];
		return rows[0] ?? null;
	}

	/**
	 * Uses the legacy `trip_porters` table, like GpsParticipationSource, until the
	 * authoritative CTMS-47 `porter_assignments` source exists.
	 */
	async isPorterAssigned(tripId: string, porterId: string): Promise<boolean> {
		const rows = (await this.dataSource.query(
			`SELECT 1 FROM "trip_porters" WHERE "trip_id" = $1 AND "porter_id" = $2 AND "status" = $3`,
			[tripId, porterId, TripPorterStatus.ASSIGNED]
		)) as unknown[];
		return rows.length > 0;
	}

	/**
	 * Stores the incident and its audit entry in one transaction. `ON CONFLICT DO NOTHING`
	 * turns a repeated or concurrent sync of the same id into a no-op, so the caller can
	 * tell a fresh insert (true) from an existing row (false) without a race.
	 */
	async insertIfAbsent(incident: NewIncident): Promise<boolean> {
		return this.dataSource.transaction(async (manager) => {
			const inserted = (await manager.query(
				`INSERT INTO "trip_incidents" (
					"id", "trip_id", "reporter_id", "category", "severity", "description", "occurred_at",
					"location", "location_accuracy_meters", "location_captured_at", "location_status",
					"captured_offline"
				 ) VALUES (
					$1, $2, $3, $4, $5, $6, $7,
					CASE WHEN $8::double precision IS NULL THEN NULL
					     ELSE ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography END,
					$10, $11, $12, $13
				 )
				 ON CONFLICT ("id") DO NOTHING
				 RETURNING "id"`,
				[
					incident.id,
					incident.tripId,
					incident.reporterId,
					incident.category,
					incident.severity,
					incident.description,
					incident.occurredAt,
					incident.latitude,
					incident.longitude,
					incident.locationAccuracyMeters,
					incident.locationCapturedAt,
					incident.locationStatus,
					incident.capturedOffline,
				]
			)) as Array<{ id: string }>;
			if (inserted.length === 0) {
				return false;
			}
			// Audit keeps the classification only; description and coordinates stay in the record itself.
			await manager.query(
				`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after")
				 VALUES ($1, $2, $3, $4, NULL, $5::jsonb)`,
				[
					incident.reporterId,
					INCIDENT_AUDIT_ACTION,
					INCIDENT_AUDIT_TARGET,
					incident.id,
					JSON.stringify({
						tripId: incident.tripId,
						category: incident.category,
						severity: incident.severity,
						locationStatus: incident.locationStatus,
						capturedOffline: incident.capturedOffline,
					}),
				]
			);
			return true;
		});
	}

	async findById(incidentId: string): Promise<IncidentRow | null> {
		const rows = (await this.dataSource.query(`${INCIDENT_SELECT} WHERE incident."id" = $1`, [
			incidentId,
		])) as IncidentRow[];
		return rows[0] ?? null;
	}

	/** Newest first. `reporterId` narrows the list to one Porter's own reports. */
	async listForTrip(tripId: string, reporterId: string | null): Promise<IncidentRow[]> {
		return (await this.dataSource.query(
			`${INCIDENT_SELECT}
			 WHERE incident."trip_id" = $1 AND ($2::uuid IS NULL OR incident."reporter_id" = $2)
			 ORDER BY incident."occurred_at" DESC, incident."id" ASC`,
			[tripId, reporterId]
		)) as IncidentRow[];
	}

	/**
	 * Attaches media only when the incident has none yet, so a retried upload never
	 * replaces an already-verified photo. Returns whether this call attached it.
	 */
	async attachMediaIfAbsent(
		incidentId: string,
		actorId: string,
		media: IncidentMedia
	): Promise<boolean> {
		return this.dataSource.transaction(async (manager) => {
			const updated = (await manager.query(
				`UPDATE "trip_incidents"
				 SET "media_url" = $2, "media_content_type" = $3, "media_size_bytes" = $4,
				     "media_uploaded_at" = now()
				 WHERE "id" = $1 AND "media_url" IS NULL
				 RETURNING "id"`,
				[incidentId, media.url, media.contentType, media.sizeBytes]
			)) as [Array<{ id: string }>, number];
			if (updated[0].length === 0) {
				return false;
			}
			await manager.query(
				`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after")
				 VALUES ($1, $2, $3, $4, NULL, $5::jsonb)`,
				[
					actorId,
					INCIDENT_MEDIA_AUDIT_ACTION,
					INCIDENT_AUDIT_TARGET,
					incidentId,
					JSON.stringify({ contentType: media.contentType, sizeBytes: media.sizeBytes }),
				]
			);
			return true;
		});
	}
}

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import { TripPorterStatus } from "../profiles/entities/trip-porter.entity";
import type { TripStatus } from "../trips/entities/trip.entity";
import {
	IncidentActionType,
	type IncidentCategory,
	type IncidentLocationStatus,
	type IncidentSeverity,
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
	assignedTo: string | null;
	assignedToName: string | null;
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

export interface IncidentActionRow {
	id: string;
	incidentId: string;
	actorId: string;
	actorName: string | null;
	actorRole: string | null;
	action: IncidentActionType;
	fromStatus: IncidentStatus | null;
	toStatus: IncidentStatus | null;
	note: string | null;
	createdAt: Date;
}

const INCIDENT_AUDIT_ACTION = "incident.report";
const INCIDENT_MEDIA_AUDIT_ACTION = "incident.media.attach";
const INCIDENT_ASSIGN_AUDIT_ACTION = "incident.assign";
const INCIDENT_STATUS_AUDIT_ACTION = "incident.status_change";
const INCIDENT_AUDIT_TARGET = "trip_incident";

const INCIDENT_SELECT = `
	SELECT incident."id", incident."trip_id" AS "tripId", incident."reporter_id" AS "reporterId",
	       reporter."full_name" AS "reporterName",
	       incident."assigned_to" AS "assignedTo",
	       assignee."full_name" AS "assignedToName",
	       incident."category", incident."severity",
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
	LEFT JOIN "users" reporter ON reporter."id" = incident."reporter_id"
	LEFT JOIN "users" assignee ON assignee."id" = incident."assigned_to"`;

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

	async findUser(userId: string): Promise<{ id: string; fullName: string; role: string } | null> {
		const rows = (await this.dataSource.query(
			`SELECT "id", "full_name" AS "fullName", "role" FROM "users" WHERE "id" = $1`,
			[userId]
		)) as Array<{ id: string; fullName: string; role: string }>;
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

			// Record action entry in incident_actions table (CTMS-086, PB AC-4).
			const actionId = randomUUID();
			await manager.query(
				`INSERT INTO "incident_actions" (
					"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note"
				 ) VALUES ($1, $2, $3, $4, NULL, $5, NULL)`,
				[
					actionId,
					incident.id,
					incident.reporterId,
					IncidentActionType.REPORTED,
					IncidentStatus.OPEN,
				]
			);

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

	/**
	 * Assigns handling responsibility for an incident (CTMS-086, PB AC-2).
	 * Records an immutable action history item and audit log in the same transaction.
	 */
	async assignHandler(
		incidentId: string,
		actorId: string,
		assignedTo: string | null,
		note?: string | null
	): Promise<IncidentRow | null> {
		return this.dataSource.transaction(async (manager) => {
			const locked = (await manager.query(
				`SELECT "id", "assigned_to" AS "assignedTo", "status"
				 FROM "trip_incidents" WHERE "id" = $1 FOR UPDATE`,
				[incidentId]
			)) as Array<{ id: string; assignedTo: string | null; status: IncidentStatus }>;

			if (locked.length === 0) {
				return null;
			}

			const current = locked[0];

			await manager.query(
				`UPDATE "trip_incidents"
				 SET "assigned_to" = $2
				 WHERE "id" = $1`,
				[incidentId, assignedTo]
			);

			const actionId = randomUUID();
			await manager.query(
				`INSERT INTO "incident_actions" (
					"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note"
				 ) VALUES ($1, $2, $3, $4, $5, $5, $6)`,
				[actionId, incidentId, actorId, IncidentActionType.ASSIGNED, current.status, note ?? null]
			);

			await manager.query(
				`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after")
				 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
				[
					actorId,
					INCIDENT_ASSIGN_AUDIT_ACTION,
					INCIDENT_AUDIT_TARGET,
					incidentId,
					JSON.stringify({ assignedTo: current.assignedTo }),
					JSON.stringify({ assignedTo, note: note ?? null }),
				]
			);

			const updatedRows = (await manager.query(`${INCIDENT_SELECT} WHERE incident."id" = $1`, [
				incidentId,
			])) as IncidentRow[];

			return updatedRows[0] ?? null;
		});
	}

	/**
	 * Updates an incident's handling status following valid lifecycle transitions (CTMS-086, PB AC-3).
	 * Locks the row with `FOR UPDATE` so concurrent mutations never silently overwrite (BR-213, PB AC-3).
	 */
	async updateStatus(
		incidentId: string,
		actorId: string,
		expectedFromStatus: IncidentStatus,
		toStatus: IncidentStatus,
		note?: string | null
	): Promise<IncidentRow | null> {
		return this.dataSource.transaction(async (manager) => {
			const locked = (await manager.query(
				`SELECT "id", "status", "assigned_to" AS "assignedTo"
				 FROM "trip_incidents" WHERE "id" = $1 FOR UPDATE`,
				[incidentId]
			)) as Array<{ id: string; status: IncidentStatus; assignedTo: string | null }>;

			if (locked.length === 0) {
				return null;
			}

			const current = locked[0];
			if (current.status !== expectedFromStatus) {
				// Concurrently modified
				return null;
			}

			await manager.query(
				`UPDATE "trip_incidents"
				 SET "status" = $2
				 WHERE "id" = $1`,
				[incidentId, toStatus]
			);

			const actionId = randomUUID();
			await manager.query(
				`INSERT INTO "incident_actions" (
					"id", "incident_id", "actor_id", "action", "from_status", "to_status", "note"
				 ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					actionId,
					incidentId,
					actorId,
					IncidentActionType.STATUS_CHANGED,
					expectedFromStatus,
					toStatus,
					note ?? null,
				]
			);

			await manager.query(
				`INSERT INTO "audit_logs" ("actor_id", "action", "target_type", "target_id", "before", "after")
				 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
				[
					actorId,
					INCIDENT_STATUS_AUDIT_ACTION,
					INCIDENT_AUDIT_TARGET,
					incidentId,
					JSON.stringify({ status: expectedFromStatus }),
					JSON.stringify({ status: toStatus, note: note ?? null }),
				]
			);

			const updatedRows = (await manager.query(`${INCIDENT_SELECT} WHERE incident."id" = $1`, [
				incidentId,
			])) as IncidentRow[];

			return updatedRows[0] ?? null;
		});
	}

	/** Chronological action history of the incident (CTMS-086, PB AC-4). */
	async listActions(incidentId: string): Promise<IncidentActionRow[]> {
		return (await this.dataSource.query(
			`SELECT action."id", action."incident_id" AS "incidentId", action."actor_id" AS "actorId",
			        actor."full_name" AS "actorName", actor."role" AS "actorRole",
			        action."action", action."from_status" AS "fromStatus", action."to_status" AS "toStatus",
			        action."note", action."created_at" AS "createdAt"
			 FROM "incident_actions" action
			 LEFT JOIN "users" actor ON actor."id" = action."actor_id"
			 WHERE action."incident_id" = $1
			 ORDER BY action."created_at" ASC`,
			[incidentId]
		)) as IncidentActionRow[];
	}
}

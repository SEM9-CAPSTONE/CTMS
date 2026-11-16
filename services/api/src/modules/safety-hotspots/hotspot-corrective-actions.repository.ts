import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import type {
	CorrectiveActionType,
	PackageImpact,
	SafetyHotspotStatus,
} from "./safety-hotspots.enums";

/** The hotspot fields a corrective action relies on, read under a row lock. */
export interface LockedHotspot {
	id: string;
	routeId: string;
	routeVersion: string;
	status: SafetyHotspotStatus;
	statusChangedAt: Date;
	evidenceHash: string;
}

export interface NewCorrectiveAction {
	hotspotId: string;
	routeId: string;
	actionType: CorrectiveActionType;
	targetType: string | null;
	targetId: string | null;
	reason: string;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
	hotspotStatusChangedAt: Date;
	hotspotEvidenceHash: string;
	hotspotRouteVersion: string;
	packageImpact: PackageImpact;
	impactTripIds: string[];
	actorId: string;
}

export interface CorrectiveActionRow {
	id: string;
	hotspotId: string;
	actionType: CorrectiveActionType;
	targetType: string | null;
	targetName: string | null;
	reason: string;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
	packageImpact: PackageImpact;
	impactTripCount: number;
	impactRequestedAt: Date | null;
	actorName: string | null;
	createdAt: Date;
}

export interface PendingImpact {
	id: string;
	impactTripIds: string[];
}

export interface RouteSafetyTargets {
	checkpoints: Array<{ id: string; name: string; routePosition: number; instructions: string }>;
	hazardAreas: Array<{
		id: string;
		description: string;
		severity: string;
		geometry: unknown;
		radiusMeters: number | null;
	}>;
}

/** CTMS-118: corrective actions taken from CONFIRMED hotspots, and the reads they need. */
@Injectable()
export class HotspotCorrectiveActionsRepository {
	constructor(private readonly dataSource: DataSource) {}

	transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async lockHotspot(manager: EntityManager, hotspotId: string): Promise<LockedHotspot | null> {
		const rows = (await manager.query(
			`SELECT "id", "route_id" AS "routeId", "route_version" AS "routeVersion", "status",
			        "status_changed_at" AS "statusChangedAt", "evidence_hash" AS "evidenceHash"
			 FROM "potential_safety_hotspots" WHERE "id" = $1 FOR UPDATE`,
			[hotspotId]
		)) as LockedHotspot[];
		return rows[0] ?? null;
	}

	/** Locks the Route row so Route lifecycle changes cannot interleave with the correction. */
	async lockRouteStatus(manager: EntityManager, routeId: string): Promise<string | null> {
		const rows = (await manager.query(
			`SELECT "status" FROM "trekking_routes" WHERE "id" = $1 FOR UPDATE`,
			[routeId]
		)) as Array<{ status: string }>;
		return rows[0]?.status ?? null;
	}

	/** Trips whose next package can still change: published, not yet started (ongoing keeps its version). */
	async findPublishedTripIds(manager: EntityManager, routeId: string): Promise<string[]> {
		const rows = (await manager.query(
			`SELECT "id" FROM "trips" WHERE "route_id" = $1 AND "status" = 'published' ORDER BY "id"`,
			[routeId]
		)) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	async insert(manager: EntityManager, action: NewCorrectiveAction): Promise<string> {
		const [{ id }] = (await manager.query(
			`INSERT INTO "hotspot_corrective_actions"
			   ("hotspot_id", "route_id", "action_type", "target_type", "target_id", "reason", "before", "after",
			    "hotspot_status_changed_at", "hotspot_evidence_hash", "hotspot_route_version",
			    "package_impact", "impact_trip_ids", "actor_id")
			 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13::uuid[], $14)
			 RETURNING "id"`,
			[
				action.hotspotId,
				action.routeId,
				action.actionType,
				action.targetType,
				action.targetId,
				action.reason,
				action.before === null ? null : JSON.stringify(action.before),
				action.after === null ? null : JSON.stringify(action.after),
				action.hotspotStatusChangedAt,
				action.hotspotEvidenceHash,
				action.hotspotRouteVersion,
				action.packageImpact,
				action.impactTripIds,
				action.actorId,
			]
		)) as Array<{ id: string }>;
		return id;
	}

	async markImpactRequested(actionId: string, at: Date): Promise<void> {
		await this.dataSource.query(
			`UPDATE "hotspot_corrective_actions" SET "impact_requested_at" = $2
			 WHERE "id" = $1 AND "impact_requested_at" IS NULL`,
			[actionId, at]
		);
	}

	async findPendingImpacts(limit: number): Promise<PendingImpact[]> {
		return (await this.dataSource.query(
			`SELECT "id", "impact_trip_ids" AS "impactTripIds" FROM "hotspot_corrective_actions"
			 WHERE "package_impact" = 'AFFECTED' AND "impact_requested_at" IS NULL
			 ORDER BY "created_at" LIMIT $1`,
			[limit]
		)) as PendingImpact[];
	}

	async findById(actionId: string): Promise<CorrectiveActionRow | null> {
		const rows = await this.selectActions(`action."id" = $1`, [actionId]);
		return rows[0] ?? null;
	}

	listByHotspot(hotspotId: string): Promise<CorrectiveActionRow[]> {
		return this.selectActions(`action."hotspot_id" = $1`, [hotspotId]);
	}

	/** Checkpoints and hazard areas of one Route, named for selection (no ids shown to users). */
	async findRouteSafetyTargets(routeId: string): Promise<RouteSafetyTargets> {
		const checkpoints = (await this.dataSource.query(
			`SELECT "id", "name", "route_position" AS "routePosition", "instructions"
			 FROM "checkpoints" WHERE "route_id" = $1
			 ORDER BY "route_position", "created_at", "id"`,
			[routeId]
		)) as RouteSafetyTargets["checkpoints"];
		const hazardAreas = (await this.dataSource.query(
			`SELECT "id", "description", "severity", ST_AsGeoJSON("geom"::geometry)::json AS "geometry",
			        "radius_m" AS "radiusMeters"
			 FROM "route_danger_zones" WHERE "route_id" = $1
			 ORDER BY "created_at", "id"`,
			[routeId]
		)) as RouteSafetyTargets["hazardAreas"];
		return {
			checkpoints: checkpoints.map((row) => ({ ...row, routePosition: Number(row.routePosition) })),
			hazardAreas: hazardAreas.map((row) => ({
				...row,
				radiusMeters: row.radiusMeters == null ? null : Number(row.radiusMeters),
			})),
		};
	}

	private async selectActions(
		condition: string,
		params: unknown[]
	): Promise<CorrectiveActionRow[]> {
		const rows = (await this.dataSource.query(
			`SELECT action."id", action."hotspot_id" AS "hotspotId", action."action_type" AS "actionType",
			        action."target_type" AS "targetType",
			        COALESCE(checkpoint."name", zone."description") AS "targetName",
			        action."reason", action."before", action."after", action."package_impact" AS "packageImpact",
			        cardinality(action."impact_trip_ids") AS "impactTripCount",
			        action."impact_requested_at" AS "impactRequestedAt",
			        actor."full_name" AS "actorName", action."created_at" AS "createdAt"
			 FROM "hotspot_corrective_actions" action
			 INNER JOIN "users" actor ON actor."id" = action."actor_id"
			 LEFT JOIN "checkpoints" checkpoint
			   ON action."target_type" = 'trekking_route_checkpoint' AND checkpoint."id" = action."target_id"
			 LEFT JOIN "route_danger_zones" zone
			   ON action."target_type" = 'trekking_route_danger_zone' AND zone."id" = action."target_id"
			 WHERE ${condition}
			 ORDER BY action."created_at" DESC, action."id" DESC`,
			params
		)) as CorrectiveActionRow[];
		return rows.map((row) => ({ ...row, impactTripCount: Number(row.impactTripCount) }));
	}
}

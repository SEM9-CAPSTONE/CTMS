import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import type { SafetyHotspotStatus } from "./safety-hotspots.enums";

export interface EligibleDeviationEvent {
	id: string;
	tripId: string;
	userId: string;
	routeId: string;
	routeVersion: string;
	startedAt: Date;
}

export interface ClusterSummary {
	centerLng: number;
	centerLat: number;
	routeFractionMin: number;
	routeFractionMax: number;
	firstEventAt: Date;
	lastEventAt: Date;
}

export interface NearbyHotspot {
	id: string;
	status: SafetyHotspotStatus;
	statusChangedAt: Date;
}

export interface NewHotspot {
	routeId: string;
	routeVersion: string;
	analysisVersion: string;
	configVersion: string;
	criteria: Record<string, unknown>;
	windowStart: Date;
	windowEnd: Date;
	centerLng: number;
	centerLat: number;
	radiusMeters: number;
	anchorEventId: string;
	routeFractionMin: number;
	routeFractionMax: number;
	eventCount: number;
	distinctTripCount: number;
	distinctMemberCount: number;
	evidenceEventIds: string[];
	evidenceHash: string;
	firstEventAt: Date;
	lastEventAt: Date;
	previousHotspotId: string | null;
	detectionRunId: string;
	detectedAt: Date;
}

/** Fields exposed to Admins: aggregates and evidence ids only, no member ids or member points. */
const HOTSPOT_COLUMNS = `hotspot."id", hotspot."route_id" AS "routeId", hotspot."route_version" AS "routeVersion",
	hotspot."status", hotspot."status_changed_at" AS "statusChangedAt",
	hotspot."analysis_version" AS "analysisVersion", hotspot."config_version" AS "configVersion",
	hotspot."criteria", hotspot."window_start" AS "windowStart", hotspot."window_end" AS "windowEnd",
	ST_Y(hotspot."center"::geometry) AS "centerLat", ST_X(hotspot."center"::geometry) AS "centerLng",
	hotspot."radius_meters" AS "radiusMeters", hotspot."anchor_event_id" AS "anchorEventId",
	hotspot."route_fraction_min" AS "routeFractionMin", hotspot."route_fraction_max" AS "routeFractionMax",
	hotspot."event_count" AS "eventCount", hotspot."distinct_trip_count" AS "distinctTripCount",
	hotspot."distinct_member_count" AS "distinctMemberCount", hotspot."evidence_event_ids" AS "evidenceEventIds",
	hotspot."evidence_hash" AS "evidenceHash", hotspot."first_event_at" AS "firstEventAt",
	hotspot."last_event_at" AS "lastEventAt", hotspot."previous_hotspot_id" AS "previousHotspotId",
	hotspot."detection_run_id" AS "detectionRunId", hotspot."detected_at" AS "detectedAt"`;

export type SafetyHotspotRow = Omit<NewHotspot, "centerLng" | "centerLat"> & {
	id: string;
	status: SafetyHotspotStatus;
	statusChangedAt: Date;
	centerLat: number;
	centerLng: number;
};

/** CTMS-116: reads RouteDeviationEvents and writes only hotspot tables (BR-356). */
@Injectable()
export class SafetyHotspotsRepository {
	constructor(private readonly dataSource: DataSource) {}

	transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	/** One detection at a time across the whole system. */
	async lockDetection(manager: EntityManager): Promise<void> {
		await manager.query("SELECT pg_advisory_xact_lock(hashtext('safety-hotspot-detection'))");
	}

	/** Authoritative episodes of one analysis version that started inside the rolling window. */
	async findEligibleEvents(
		manager: EntityManager,
		analysisVersion: string,
		windowStart: Date,
		windowEnd: Date
	): Promise<EligibleDeviationEvent[]> {
		const rows = (await manager.query(
			`SELECT "id", "trip_id" AS "tripId", "user_id" AS "userId", "route_id" AS "routeId",
			        "route_version" AS "routeVersion", "started_at" AS "startedAt"
			 FROM "route_deviation_events"
			 WHERE "analysis_version" = $1 AND "authoritative" = true
			   AND "started_at" > $2 AND "started_at" <= $3
			 ORDER BY "route_id", "route_version", "started_at", "id"`,
			[analysisVersion, windowStart, windowEnd]
		)) as EligibleDeviationEvent[];
		return rows.map((row) => ({ ...row, startedAt: new Date(row.startedAt) }));
	}

	/** Pairs of events on the same Route version whose start points are within `radius` metres. */
	async findNeighborPairs(
		manager: EntityManager,
		eventIds: string[],
		radiusMeters: number
	): Promise<Array<{ a: string; b: string }>> {
		if (eventIds.length === 0) return [];
		return (await manager.query(
			`SELECT a."id" AS "a", b."id" AS "b"
			 FROM "route_deviation_events" a
			 INNER JOIN "route_deviation_events" b
			   ON b."route_id" = a."route_id" AND b."route_version" = a."route_version"
			  AND ST_DWithin(a."start_location", b."start_location", $2)
			 WHERE a."id" = ANY($1::uuid[]) AND b."id" = ANY($1::uuid[])`,
			[eventIds, radiusMeters]
		)) as Array<{ a: string; b: string }>;
	}

	/** Cluster centre (centroid of the start points), Route span and evidence time range. */
	async summarizeCluster(manager: EntityManager, eventIds: string[]): Promise<ClusterSummary> {
		const [row] = (await manager.query(
			`SELECT ST_X(ST_Centroid(ST_Collect("start_location"::geometry))) AS "centerLng",
			        ST_Y(ST_Centroid(ST_Collect("start_location"::geometry))) AS "centerLat",
			        min("start_route_fraction") AS "routeFractionMin", max("start_route_fraction") AS "routeFractionMax",
			        min("started_at") AS "firstEventAt", max("started_at") AS "lastEventAt"
			 FROM "route_deviation_events" WHERE "id" = ANY($1::uuid[])`,
			[eventIds]
		)) as ClusterSummary[];
		return {
			centerLng: Number(row.centerLng),
			centerLat: Number(row.centerLat),
			routeFractionMin: Number(row.routeFractionMin),
			routeFractionMax: Number(row.routeFractionMax),
			firstEventAt: new Date(row.firstEventAt),
			lastEventAt: new Date(row.lastEventAt),
		};
	}

	/** Existing candidates of the same Route version whose centre is within `radius` metres. */
	async findNearbyHotspots(
		manager: EntityManager,
		routeId: string,
		routeVersion: string,
		center: { lng: number; lat: number },
		radiusMeters: number
	): Promise<NearbyHotspot[]> {
		return (await manager.query(
			`SELECT "id", "status", "status_changed_at" AS "statusChangedAt"
			 FROM "potential_safety_hotspots"
			 WHERE "route_id" = $1 AND "route_version" = $2
			   AND ST_DWithin("center", ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)
			 ORDER BY "status_changed_at" DESC, "id" DESC`,
			[routeId, routeVersion, center.lng, center.lat, radiusMeters]
		)) as NearbyHotspot[];
	}

	async insertRun(
		manager: EntityManager,
		run: {
			analysisVersion: string;
			configVersion: string;
			criteria: Record<string, unknown>;
			windowStart: Date;
			windowEnd: Date;
			eventsConsidered: number;
			triggeredBy: string | null;
			ranAt: Date;
		}
	): Promise<string> {
		const [{ id }] = (await manager.query(
			`INSERT INTO "hotspot_detection_runs"
			   ("analysis_version", "config_version", "criteria", "window_start", "window_end",
			    "events_considered", "clusters_found", "candidates_created", "triggered_by", "ran_at")
			 VALUES ($1, $2, $3::jsonb, $4, $5, $6, 0, 0, $7, $8) RETURNING "id"`,
			[
				run.analysisVersion,
				run.configVersion,
				JSON.stringify(run.criteria),
				run.windowStart,
				run.windowEnd,
				run.eventsConsidered,
				run.triggeredBy,
				run.ranAt,
			]
		)) as Array<{ id: string }>;
		return id;
	}

	async finishRun(
		manager: EntityManager,
		runId: string,
		result: { clustersFound: number; candidatesCreated: number; skipped: Record<string, number> }
	): Promise<void> {
		await manager.query(
			`UPDATE "hotspot_detection_runs"
			 SET "clusters_found" = $2, "candidates_created" = $3, "skipped" = $4::jsonb WHERE "id" = $1`,
			[runId, result.clustersFound, result.candidatesCreated, JSON.stringify(result.skipped)]
		);
	}

	/** Inserts a DETECTED candidate; null when the same evidence already produced one. */
	async insertHotspot(manager: EntityManager, hotspot: NewHotspot): Promise<string | null> {
		const rows = (await manager.query(
			`INSERT INTO "potential_safety_hotspots"
			   ("route_id", "route_version", "status", "status_changed_at", "analysis_version", "config_version",
			    "criteria", "window_start", "window_end", "center", "radius_meters", "anchor_event_id",
			    "route_fraction_min", "route_fraction_max", "event_count", "distinct_trip_count",
			    "distinct_member_count", "evidence_event_ids", "evidence_hash", "first_event_at", "last_event_at",
			    "previous_hotspot_id", "detection_run_id", "detected_at")
			 VALUES ($1, $2, 'DETECTED', $3, $4, $5, $6::jsonb, $7, $8,
			   ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography, $11, $12, $13, $14, $15, $16, $17,
			   $18::uuid[], $19, $20, $21, $22, $23, $3)
			 ON CONFLICT ("route_id", "route_version", "analysis_version", "evidence_hash") DO NOTHING
			 RETURNING "id"`,
			[
				hotspot.routeId,
				hotspot.routeVersion,
				hotspot.detectedAt,
				hotspot.analysisVersion,
				hotspot.configVersion,
				JSON.stringify(hotspot.criteria),
				hotspot.windowStart,
				hotspot.windowEnd,
				hotspot.centerLng,
				hotspot.centerLat,
				hotspot.radiusMeters,
				hotspot.anchorEventId,
				Math.min(1, Math.max(0, hotspot.routeFractionMin)),
				Math.min(1, Math.max(0, hotspot.routeFractionMax)),
				hotspot.eventCount,
				hotspot.distinctTripCount,
				hotspot.distinctMemberCount,
				hotspot.evidenceEventIds,
				hotspot.evidenceHash,
				hotspot.firstEventAt,
				hotspot.lastEventAt,
				hotspot.previousHotspotId,
				hotspot.detectionRunId,
			]
		)) as Array<{ id: string }>;
		return rows[0]?.id ?? null;
	}

	async findById(id: string): Promise<SafetyHotspotRow | null> {
		const rows = (await this.dataSource.query(
			`SELECT ${HOTSPOT_COLUMNS} FROM "potential_safety_hotspots" hotspot WHERE hotspot."id" = $1`,
			[id]
		)) as SafetyHotspotRow[];
		return rows[0] ?? null;
	}

	async list(filter: {
		routeId?: string;
		status?: SafetyHotspotStatus;
		limit: number;
	}): Promise<SafetyHotspotRow[]> {
		const conditions: string[] = [];
		const params: unknown[] = [];
		if (filter.routeId) {
			params.push(filter.routeId);
			conditions.push(`hotspot."route_id" = $${params.length}`);
		}
		if (filter.status) {
			params.push(filter.status);
			conditions.push(`hotspot."status" = $${params.length}`);
		}
		params.push(filter.limit);
		return (await this.dataSource.query(
			`SELECT ${HOTSPOT_COLUMNS} FROM "potential_safety_hotspots" hotspot
			 ${conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""}
			 ORDER BY hotspot."detected_at" DESC, hotspot."id" DESC
			 LIMIT $${params.length}`,
			params
		)) as SafetyHotspotRow[];
	}
}

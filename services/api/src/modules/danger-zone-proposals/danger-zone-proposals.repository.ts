import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import type {
	RouteDangerZoneGeometry,
	RouteDangerZoneSeverity,
} from "../trekking-routes/entities/route-danger-zone.entity";
import type {
	DangerZoneHazardType,
	DangerZoneProposalSource,
	DangerZoneProposalStatus,
} from "./danger-zone-proposals.enums";

/** What the Admin needs to decide. Raw member positions are never part of a proposal (BR-361). */
export interface DangerZoneProposalRow {
	id: string;
	source: DangerZoneProposalSource;
	status: DangerZoneProposalStatus;
	hazardType: DangerZoneHazardType;
	severity: RouteDangerZoneSeverity;
	description: string;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | null;
	locationAccuracyMeters: number | null;
	observedAt: Date;
	createdAt: Date;
	routeId: string;
	routeName: string;
	routeGeometry: { type: "LineString"; coordinates: Array<[number, number]> };
	proposerName: string;
	tripTitle: string | null;
	tripStartsAt: Date | null;
	reviewerName: string | null;
	reviewedAt: Date | null;
	reviewReason: string | null;
	dangerZoneId: string | null;
}

export interface LockedProposal {
	id: string;
	status: DangerZoneProposalStatus;
	routeId: string;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | null;
	hazardType: DangerZoneHazardType;
	source: DangerZoneProposalSource;
}

export interface NewHostProposal {
	routeId: string;
	proposerId: string;
	hazardType: DangerZoneHazardType;
	geometry: RouteDangerZoneGeometry;
	radiusMeters: number | null;
	severity: RouteDangerZoneSeverity;
	description: string;
}

const PROPOSAL_SELECT = `
	SELECT p."id", p."source", p."status", p."hazard_type" AS "hazardType", p."severity",
		p."description", ST_AsGeoJSON(p."geom"::geometry)::json AS "geometry",
		p."radius_m" AS "radiusMeters", p."location_accuracy_meters" AS "locationAccuracyMeters",
		p."observed_at" AS "observedAt", p."created_at" AS "createdAt",
		p."route_id" AS "routeId", route."name" AS "routeName",
		ST_AsGeoJSON(route."route_geom"::geometry)::json AS "routeGeometry",
		proposer."full_name" AS "proposerName",
		trip."title" AS "tripTitle", trip."starts_at" AS "tripStartsAt",
		reviewer."full_name" AS "reviewerName", p."reviewed_at" AS "reviewedAt",
		p."review_reason" AS "reviewReason", p."danger_zone_id" AS "dangerZoneId"
	FROM "danger_zone_proposals" p
	JOIN "trekking_routes" route ON route."id" = p."route_id"
	JOIN "users" proposer ON proposer."id" = p."proposer_id"
	LEFT JOIN "trip_incidents" incident ON incident."id" = p."incident_id"
	LEFT JOIN "trips" trip ON trip."id" = incident."trip_id"
	LEFT JOIN "users" reviewer ON reviewer."id" = p."reviewer_id"`;

type RawRow = Omit<DangerZoneProposalRow, "radiusMeters" | "locationAccuracyMeters"> & {
	radiusMeters: number | string | null;
	locationAccuracyMeters: number | string | null;
};

function toRow(row: RawRow): DangerZoneProposalRow {
	return {
		...row,
		radiusMeters: row.radiusMeters == null ? null : Number(row.radiusMeters),
		locationAccuracyMeters:
			row.locationAccuracyMeters == null ? null : Number(row.locationAccuracyMeters),
	};
}

@Injectable()
export class DangerZoneProposalsRepository {
	constructor(private readonly dataSource: DataSource) {}

	transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async findRouteOwner(routeId: string): Promise<string | null> {
		const rows = (await this.dataSource.query(
			`SELECT "host_id" AS "hostId" FROM "trekking_routes" WHERE "id" = $1`,
			[routeId]
		)) as Array<{ hostId: string }>;
		return rows[0]?.hostId ?? null;
	}

	async insertHostProposal(manager: EntityManager, input: NewHostProposal): Promise<string> {
		const rows = (await manager.query(
			`INSERT INTO "danger_zone_proposals"
				("source", "route_id", "proposer_id", "hazard_type", "geom", "radius_m", "severity",
				 "description", "observed_at")
			 VALUES ('HOST', $1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography, $5, $6, $7, now())
			 RETURNING "id"`,
			[
				input.routeId,
				input.proposerId,
				input.hazardType,
				JSON.stringify(input.geometry),
				input.radiusMeters,
				input.severity,
				input.description,
			]
		)) as Array<{ id: string }>;
		return rows[0].id;
	}

	async findById(id: string): Promise<DangerZoneProposalRow | null> {
		const rows = (await this.dataSource.query(`${PROPOSAL_SELECT} WHERE p."id" = $1`, [
			id,
		])) as RawRow[];
		return rows[0] ? toRow(rows[0]) : null;
	}

	async list(filter: {
		status?: DangerZoneProposalStatus;
		routeId?: string;
		limit: number;
	}): Promise<DangerZoneProposalRow[]> {
		const params: unknown[] = [];
		const conditions: string[] = [];
		if (filter.status) {
			params.push(filter.status);
			conditions.push(`p."status" = $${params.length}`);
		}
		if (filter.routeId) {
			params.push(filter.routeId);
			conditions.push(`p."route_id" = $${params.length}`);
		}
		params.push(filter.limit);
		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
		const rows = (await this.dataSource.query(
			`${PROPOSAL_SELECT} ${where} ORDER BY p."created_at" DESC, p."id" DESC LIMIT $${params.length}`,
			params
		)) as RawRow[];
		return rows.map(toRow);
	}

	async lockProposal(manager: EntityManager, id: string): Promise<LockedProposal | null> {
		const rows = (await manager.query(
			`SELECT "id", "status", "route_id" AS "routeId", "hazard_type" AS "hazardType", "source",
				ST_AsGeoJSON("geom"::geometry)::json AS "geometry", "radius_m" AS "radiusMeters"
			 FROM "danger_zone_proposals" WHERE "id" = $1 FOR UPDATE`,
			[id]
		)) as Array<Omit<LockedProposal, "radiusMeters"> & { radiusMeters: number | string | null }>;
		const row = rows[0];
		if (!row) return null;
		return { ...row, radiusMeters: row.radiusMeters == null ? null : Number(row.radiusMeters) };
	}

	/**
	 * The approved snapshot is read back from the stored zone in the same transaction, so the
	 * publication check compares like with like (same GeoJSON serialization and numeric types).
	 */
	async markApproved(
		manager: EntityManager,
		id: string,
		input: { reviewerId: string; reason: string | null; dangerZoneId: string }
	): Promise<void> {
		await manager.query(
			`UPDATE "danger_zone_proposals" p SET
				"status" = 'APPROVED', "reviewer_id" = $2, "reviewed_at" = now(), "review_reason" = $3,
				"danger_zone_id" = z."id",
				"approved_snapshot" = jsonb_build_object(
					'geometry', ST_AsGeoJSON(z."geom"::geometry)::jsonb,
					'severity', z."severity"::text,
					'description', z."description",
					'radiusMeters', to_jsonb(z."radius_m")
				)
			 FROM "route_danger_zones" z
			 WHERE p."id" = $1 AND z."id" = $4`,
			[id, input.reviewerId, input.reason, input.dangerZoneId]
		);
	}

	async markRejected(
		manager: EntityManager,
		id: string,
		input: { reviewerId: string; reason: string }
	): Promise<void> {
		await manager.query(
			`UPDATE "danger_zone_proposals" SET
				"status" = 'REJECTED', "reviewer_id" = $2, "reviewed_at" = now(), "review_reason" = $3
			 WHERE "id" = $1`,
			[id, input.reviewerId, input.reason]
		);
	}
}

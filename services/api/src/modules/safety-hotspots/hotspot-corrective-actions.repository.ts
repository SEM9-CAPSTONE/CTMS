import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource } from "typeorm";
import type { CorrectiveActionType, PackageImpact } from "./safety-hotspots.enums";

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

/** CTMS-118: corrective actions taken earlier from CONFIRMED hotspots (history and package follow-up). */
@Injectable()
export class HotspotCorrectiveActionsRepository {
	constructor(private readonly dataSource: DataSource) {}

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

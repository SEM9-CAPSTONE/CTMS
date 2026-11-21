import type { MigrationInterface, QueryRunner } from "typeorm";

/** Viewport reads need an indexed geometry envelope and the latest Admin hazard decision. */
export class IndexPublishedDangerZoneReads1796300001000 implements MigrationInterface {
	name = "IndexPublishedDangerZoneReads1796300001000";
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE INDEX "IDX_route_danger_zones_viewport" ON "route_danger_zones" USING GIST ((geom::geometry))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_hotspot_corrective_actions_hazard_target" ON "hotspot_corrective_actions" (target_id,route_id,created_at DESC,id DESC)
		 WHERE target_type='trekking_route_danger_zone' AND action_type IN ('ADD_HAZARD_AREA','UPDATE_HAZARD_AREA')`);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hotspot_corrective_actions_hazard_target"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_route_danger_zones_viewport"`);
	}
}

import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-118. Corrective actions an authorized Admin applies to authoritative Route safety data
 * on the basis of a CONFIRMED PotentialSafetyHotspot (BR-358, BR-419, BR-423). Each row keeps
 * the hotspot, the review evidence it relied on, the affected safety entity with before/after
 * snapshots, the reason and the Offline Safety Package impact (BR-359). Rows are never edited,
 * except to stamp when the package impact was handed to the package generator.
 */
export class CreateHotspotCorrectiveActions1796300000000 implements MigrationInterface {
	name = "CreateHotspotCorrectiveActions1796300000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "hotspot_corrective_actions" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"hotspot_id" uuid NOT NULL,
				"route_id" uuid NOT NULL,
				"action_type" varchar(40) NOT NULL,
				"target_type" varchar(40),
				"target_id" uuid,
				"reason" text NOT NULL,
				"before" jsonb,
				"after" jsonb,
				"hotspot_status_changed_at" timestamptz NOT NULL,
				"hotspot_evidence_hash" char(64) NOT NULL,
				"hotspot_route_version" varchar(64) NOT NULL,
				"package_impact" varchar(16) NOT NULL,
				"impact_trip_ids" uuid[] NOT NULL DEFAULT '{}',
				"impact_requested_at" timestamptz,
				"actor_id" uuid NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_hotspot_corrective_actions" PRIMARY KEY ("id"),
				CONSTRAINT "CHK_hotspot_corrective_actions_type" CHECK ("action_type" IN (
					'ADD_HAZARD_AREA', 'UPDATE_HAZARD_AREA', 'UPDATE_CHECKPOINT_INSTRUCTIONS',
					'NO_DATA_CHANGE', 'OTHER'
				)),
				CONSTRAINT "CHK_hotspot_corrective_actions_target" CHECK (
					("action_type" IN ('NO_DATA_CHANGE', 'OTHER') AND "target_type" IS NULL AND "target_id" IS NULL)
					OR ("action_type" IN ('ADD_HAZARD_AREA', 'UPDATE_HAZARD_AREA')
						AND "target_type" = 'trekking_route_danger_zone' AND "target_id" IS NOT NULL)
					OR ("action_type" = 'UPDATE_CHECKPOINT_INSTRUCTIONS'
						AND "target_type" = 'trekking_route_checkpoint' AND "target_id" IS NOT NULL)
				),
				CONSTRAINT "CHK_hotspot_corrective_actions_reason" CHECK (char_length(btrim("reason")) >= 10),
				CONSTRAINT "CHK_hotspot_corrective_actions_impact" CHECK (
					("package_impact" = 'AFFECTED')
					OR ("package_impact" = 'NOT_AFFECTED' AND cardinality("impact_trip_ids") = 0)
				),
				CONSTRAINT "FK_hotspot_corrective_actions_hotspot" FOREIGN KEY ("hotspot_id")
					REFERENCES "potential_safety_hotspots" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_hotspot_corrective_actions_route" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_hotspot_corrective_actions_actor" FOREIGN KEY ("actor_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_hotspot_corrective_actions_hotspot" ON "hotspot_corrective_actions" ("hotspot_id", "created_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_hotspot_corrective_actions_pending_impact" ON "hotspot_corrective_actions" ("created_at")
			 WHERE "package_impact" = 'AFFECTED' AND "impact_requested_at" IS NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "hotspot_corrective_actions"`);
	}
}

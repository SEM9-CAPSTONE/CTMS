import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-110. Revenue analytics by time and area.
 *
 * - `geo_areas`: reference list of reporting areas. The MVP operates in Đà Nẵng only and uses the
 *   familiar former districts (before the 07/2025 administrative reform) as the area dimension.
 * - `trips.province_*` / `trips.area_*`: snapshot copied from `geo_areas` when a draft Trip is
 *   saved (BR-319). Reports read the snapshot, so renaming an area later does not rewrite history.
 * - `payments.succeeded_at` / `payouts.succeeded_at`: fixed KPI date basis (BR-326). Filled by a
 *   trigger the first time a row reaches `succeeded`, so every code path (API, webhook, seed,
 *   reconciliation) records the same moment without having to remember to set it.
 */
export class AddTripAreaSnapshotAndFinancialTimestamps1796200000000 implements MigrationInterface {
	name = "AddTripAreaSnapshotAndFinancialTimestamps1796200000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "geo_areas" (
				"code" varchar(32) PRIMARY KEY,
				"province_code" varchar(16) NOT NULL,
				"province_name" varchar(100) NOT NULL,
				"name" varchar(100) NOT NULL,
				"sort_order" smallint NOT NULL DEFAULT 0,
				"active" boolean NOT NULL DEFAULT true,
				"created_at" timestamptz NOT NULL DEFAULT now()
			)
		`);
		await queryRunner.query(`
			INSERT INTO "geo_areas" ("code", "province_code", "province_name", "name", "sort_order") VALUES
				('DNG-HAI-CHAU', 'DNG', 'Đà Nẵng', 'Hải Châu', 1),
				('DNG-THANH-KHE', 'DNG', 'Đà Nẵng', 'Thanh Khê', 2),
				('DNG-SON-TRA', 'DNG', 'Đà Nẵng', 'Sơn Trà', 3),
				('DNG-NGU-HANH-SON', 'DNG', 'Đà Nẵng', 'Ngũ Hành Sơn', 4),
				('DNG-LIEN-CHIEU', 'DNG', 'Đà Nẵng', 'Liên Chiểu', 5),
				('DNG-CAM-LE', 'DNG', 'Đà Nẵng', 'Cẩm Lệ', 6),
				('DNG-HOA-VANG', 'DNG', 'Đà Nẵng', 'Hòa Vang', 7),
				('DNG-HOANG-SA', 'DNG', 'Đà Nẵng', 'Hoàng Sa', 8)
		`);

		await queryRunner.query(`
			ALTER TABLE "trips"
				ADD COLUMN "province_code" varchar(16),
				ADD COLUMN "province_name" varchar(100),
				ADD COLUMN "area_code" varchar(32),
				ADD COLUMN "area_name" varchar(100),
				ADD CONSTRAINT "FK_trips_area_code" FOREIGN KEY ("area_code")
					REFERENCES "geo_areas"("code") ON DELETE RESTRICT
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_trips_host_id_area_code" ON "trips" ("host_id", "area_code")`
		);

		await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "succeeded_at" timestamptz`);
		await queryRunner.query(`ALTER TABLE "payouts" ADD COLUMN "succeeded_at" timestamptz`);

		// Backfill: first succeeded provider transaction, falling back to the last status change.
		await queryRunner.query(`
			UPDATE "payments" p
			SET "succeeded_at" = COALESCE(
				(
					SELECT MIN(pt."created_at")
					FROM "payment_transactions" pt
					WHERE pt."payment_id" = p."id" AND pt."status" = 'succeeded'
				),
				p."updated_at"
			)
			WHERE p."status" = 'succeeded'
		`);
		await queryRunner.query(`
			UPDATE "payouts" SET "succeeded_at" = "updated_at" WHERE "status" = 'succeeded'
		`);

		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION "ctms_set_succeeded_at"() RETURNS trigger AS $$
			BEGIN
				IF NEW."status"::text = 'succeeded' THEN
					IF TG_OP = 'UPDATE' AND OLD."status"::text = 'succeeded' THEN
						NEW."succeeded_at" := COALESCE(OLD."succeeded_at", NEW."succeeded_at", clock_timestamp());
					ELSE
						NEW."succeeded_at" := COALESCE(NEW."succeeded_at", clock_timestamp());
					END IF;
				ELSE
					NEW."succeeded_at" := NULL;
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql
		`);
		await queryRunner.query(`
			CREATE TRIGGER "TRG_payments_succeeded_at"
			BEFORE INSERT OR UPDATE OF "status", "succeeded_at" ON "payments"
			FOR EACH ROW EXECUTE FUNCTION "ctms_set_succeeded_at"()
		`);
		await queryRunner.query(`
			CREATE TRIGGER "TRG_payouts_succeeded_at"
			BEFORE INSERT OR UPDATE OF "status", "succeeded_at" ON "payouts"
			FOR EACH ROW EXECUTE FUNCTION "ctms_set_succeeded_at"()
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_payments_type_status_succeeded_at"
				ON "payments" ("type", "status", "succeeded_at")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_payouts_host_id_status_succeeded_at"
				ON "payouts" ("host_id", "status", "succeeded_at")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payouts_host_id_status_succeeded_at"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_type_status_succeeded_at"`);
		await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_payouts_succeeded_at" ON "payouts"`);
		await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_payments_succeeded_at" ON "payments"`);
		await queryRunner.query(`DROP FUNCTION IF EXISTS "ctms_set_succeeded_at"()`);
		await queryRunner.query(`ALTER TABLE "payouts" DROP COLUMN "succeeded_at"`);
		await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "succeeded_at"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_host_id_area_code"`);
		await queryRunner.query(`
			ALTER TABLE "trips"
				DROP CONSTRAINT "FK_trips_area_code",
				DROP COLUMN "area_name",
				DROP COLUMN "area_code",
				DROP COLUMN "province_name",
				DROP COLUMN "province_code"
		`);
		await queryRunner.query(`DROP TABLE "geo_areas"`);
	}
}

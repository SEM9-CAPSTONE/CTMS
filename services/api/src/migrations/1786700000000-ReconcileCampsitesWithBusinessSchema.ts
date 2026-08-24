import type { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileCampsitesWithBusinessSchema1786700000000 implements MigrationInterface {
	name = "ReconcileCampsitesWithBusinessSchema1786700000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query("CREATE EXTENSION IF NOT EXISTS postgis");

		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campsites_status_enum') THEN
					ALTER TYPE "campsites_status_enum" RENAME TO "campsite_status";
				END IF;
			END $$;
		`);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zones_status_enum') THEN
					ALTER TYPE "zones_status_enum" RENAME TO "zone_status";
				END IF;
			END $$;
		`);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
					WHERE t.typname = 'campsite_status' AND e.enumlabel = 'temporarily_closed'
				) THEN
					ALTER TYPE "campsite_status" ADD VALUE 'temporarily_closed';
				END IF;
			END $$;
		`);
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
					WHERE t.typname = 'zone_status' AND e.enumlabel = 'archived'
				) THEN
					ALTER TYPE "zone_status" ADD VALUE 'archived';
				END IF;
			END $$;
		`);

		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsites_province_city"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsite_images_campsite_id_order"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zones_amenities"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zones_base_price"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zones_campsite_id"`);

		await queryRunner.query(`
			ALTER TABLE "campsites"
			ADD COLUMN IF NOT EXISTS "location" geography(Point,4326)
		`);
		await queryRunner.query(`
			UPDATE "campsites"
			SET "location" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
			WHERE "location" IS NULL
				AND EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_name = 'campsites' AND column_name = 'latitude'
				)
				AND EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_name = 'campsites' AND column_name = 'longitude'
				)
		`);
		await queryRunner.query(`
			UPDATE "campsites"
			SET "location" = ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography
			WHERE "location" IS NULL
		`);
		await queryRunner.query(`ALTER TABLE "campsites" ALTER COLUMN "location" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "campsites" ALTER COLUMN "description" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "campsites" ALTER COLUMN "description" TYPE text`);
		await queryRunner.query(`
			ALTER TABLE "campsites"
			ALTER COLUMN "policies" TYPE jsonb USING jsonb_build_object('rules', "policies")
		`);
		await queryRunner.query(`ALTER TABLE "campsites" ALTER COLUMN "policies" DROP NOT NULL`);
		await queryRunner.query(`
			ALTER TABLE "campsites"
			ALTER COLUMN "operating_hours" TYPE jsonb USING jsonb_build_object(
				'opensAt', split_part("operating_hours", '-', 1),
				'closesAt', split_part("operating_hours", '-', 2)
			)
		`);
		await queryRunner.query(`ALTER TABLE "campsites" ALTER COLUMN "operating_hours" DROP NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE "campsites" ADD COLUMN IF NOT EXISTS "season_start_date" date`
		);
		await queryRunner.query(
			`ALTER TABLE "campsites" ADD COLUMN IF NOT EXISTS "season_end_date" date`
		);
		await queryRunner.query(
			`ALTER TABLE "campsites" ADD COLUMN IF NOT EXISTS "max_advance_booking_days" integer`
		);
		await queryRunner.query(
			`ALTER TABLE "campsites" ADD COLUMN IF NOT EXISTS "min_nights" integer`
		);
		await queryRunner.query(
			`ALTER TABLE "campsites" ADD COLUMN IF NOT EXISTS "max_nights" integer`
		);
		await queryRunner.query(`ALTER TABLE "campsites" DROP COLUMN IF EXISTS "latitude"`);
		await queryRunner.query(`ALTER TABLE "campsites" DROP COLUMN IF EXISTS "longitude"`);
		await queryRunner.query(`ALTER TABLE "campsites" DROP COLUMN IF EXISTS "city"`);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_campsites_status" ON "campsites" ("status")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_campsites_province" ON "campsites" ("province")`
		);

		await queryRunner.query(`ALTER TABLE IF EXISTS "campsite_images" RENAME TO "campsite_media"`);
		await queryRunner.query(
			`ALTER TABLE "campsite_media" RENAME COLUMN "display_order" TO "sort_order"`
		);
		await queryRunner.query(`ALTER TABLE "campsite_media" DROP COLUMN IF EXISTS "created_at"`);
		await queryRunner.query(`ALTER TABLE "campsite_media" ALTER COLUMN "sort_order" SET NOT NULL`);
		await queryRunner.query(`
			ALTER TABLE "campsite_media"
			RENAME CONSTRAINT "PK_campsite_images_id" TO "PK_campsite_media_id"
		`);
		await queryRunner.query(`
			ALTER TABLE "campsite_media"
			RENAME CONSTRAINT "FK_campsite_images_campsite_id" TO "FK_campsite_media_campsite_id"
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_campsite_media_campsite_id_order"
			ON "campsite_media" ("campsite_id", "sort_order")
		`);

		await queryRunner.query(`ALTER TABLE IF EXISTS "zones" RENAME TO "campsite_zones"`);
		await queryRunner.query(
			`ALTER TABLE "campsite_zones" ADD COLUMN IF NOT EXISTS "max_tents" integer`
		);
		await queryRunner.query(
			`ALTER TABLE "campsite_zones" ADD COLUMN IF NOT EXISTS "max_people" integer`
		);
		await queryRunner.query(
			`UPDATE "campsite_zones" SET "max_tents" = COALESCE("max_tents", "capacity", 1)`
		);
		await queryRunner.query(
			`UPDATE "campsite_zones" SET "max_people" = COALESCE("max_people", "capacity", 1)`
		);
		await queryRunner.query(`ALTER TABLE "campsite_zones" ALTER COLUMN "max_tents" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "campsite_zones" ALTER COLUMN "max_people" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "campsite_zones" DROP COLUMN IF EXISTS "capacity"`);
		await queryRunner.query(`ALTER TABLE "campsite_zones" DROP COLUMN IF EXISTS "location"`);
		await queryRunner.query(`
			ALTER TABLE "campsite_zones"
			ADD COLUMN IF NOT EXISTS "location" geography(Point,4326)
		`);
		await queryRunner.query(`
			UPDATE "campsite_zones" zone
			SET "location" = campsite."location"
			FROM "campsites" campsite
			WHERE zone."campsite_id" = campsite."id" AND zone."location" IS NULL
		`);
		await queryRunner.query(`ALTER TABLE "campsite_zones" ALTER COLUMN "location" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "campsite_zones" ALTER COLUMN "amenities" DROP DEFAULT`);
		await queryRunner.query(`
			ALTER TABLE "campsite_zones"
			ALTER COLUMN "amenities" TYPE jsonb USING to_jsonb("amenities")
		`);
		await queryRunner.query(`ALTER TABLE "campsite_zones" ALTER COLUMN "amenities" DROP NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE "campsite_zones" ALTER COLUMN "amenities" SET DEFAULT '[]'::jsonb`
		);
		await queryRunner.query(
			`ALTER TABLE "campsite_zones" ADD COLUMN IF NOT EXISTS "terrain_note" text`
		);
		await queryRunner.query(`
			ALTER TABLE "campsite_zones"
			RENAME CONSTRAINT "PK_zones_id" TO "PK_campsite_zones_id"
		`);
		await queryRunner.query(`
			ALTER TABLE "campsite_zones"
			RENAME CONSTRAINT "FK_zones_campsite_id" TO "FK_campsite_zones_campsite_id"
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_campsite_zones_campsite_id"
			ON "campsite_zones" ("campsite_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_campsite_zones_base_price"
			ON "campsite_zones" ("base_price")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_campsite_zones_amenities"
			ON "campsite_zones" USING GIN ("amenities")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsite_zones_amenities"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsite_zones_base_price"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsite_zones_campsite_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsite_media_campsite_id_order"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_campsites_province"`);
		await queryRunner.query(`ALTER TABLE IF EXISTS "campsite_zones" RENAME TO "zones"`);
		await queryRunner.query(`ALTER TABLE IF EXISTS "campsite_media" RENAME TO "campsite_images"`);
	}
}

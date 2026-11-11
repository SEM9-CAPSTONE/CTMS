import type { MigrationInterface, QueryRunner } from "typeorm";

export class DetachTrekkingRoutesFromCampsites1786960000000 implements MigrationInterface {
	name = "DetachTrekkingRoutesFromCampsites1786960000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF to_regclass('public.trekking_routes') IS NULL THEN
					RETURN;
				END IF;

				IF EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_schema = 'public'
						AND table_name = 'trekking_routes'
						AND column_name = 'campsite_id'
				) THEN
					ALTER TABLE "trekking_routes" ADD COLUMN IF NOT EXISTS "host_id" uuid;

					IF to_regclass('public.campsites') IS NOT NULL THEN
						UPDATE "trekking_routes" route
						SET "host_id" = campsite."host_id"
						FROM "campsites" campsite
						WHERE route."campsite_id" = campsite."id"
							AND route."host_id" IS NULL;
					END IF;

					IF EXISTS (SELECT 1 FROM "trekking_routes" WHERE "host_id" IS NULL) THEN
						RAISE EXCEPTION 'Cannot detach trekking routes from campsites: host_id could not be backfilled';
					END IF;

					ALTER TABLE "trekking_routes" DROP CONSTRAINT IF EXISTS "FK_trekking_routes_campsite_id";
					DROP INDEX IF EXISTS "IDX_trekking_routes_campsite_id";
					ALTER TABLE "trekking_routes" DROP COLUMN "campsite_id";
				END IF;

				IF EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_schema = 'public'
						AND table_name = 'trekking_routes'
						AND column_name = 'host_id'
				) THEN
					ALTER TABLE "trekking_routes" ALTER COLUMN "host_id" SET NOT NULL;
					CREATE INDEX IF NOT EXISTS "IDX_trekking_routes_host_id" ON "trekking_routes" ("host_id");

					IF NOT EXISTS (
						SELECT 1
						FROM pg_constraint
						WHERE conname = 'FK_trekking_routes_host_id'
							AND conrelid = 'public.trekking_routes'::regclass
					) THEN
						ALTER TABLE "trekking_routes"
						ADD CONSTRAINT "FK_trekking_routes_host_id"
						FOREIGN KEY ("host_id") REFERENCES "users" ("id") ON DELETE RESTRICT;
					END IF;
				END IF;
			END $$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF to_regclass('public.trekking_routes') IS NULL THEN
					RETURN;
				END IF;

				IF NOT EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_schema = 'public'
						AND table_name = 'trekking_routes'
						AND column_name = 'campsite_id'
				) THEN
					ALTER TABLE "trekking_routes" ADD COLUMN "campsite_id" uuid;
				END IF;
			END $$;
		`);
	}
}

import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTripsTables1786980000000 implements MigrationInterface {
	name = "CreateTripsTables1786980000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
					CREATE TYPE "trip_status" AS ENUM (
						'draft',
						'pending_approval',
						'published',
						'ongoing',
						'completed',
						'cancelled'
					);
				END IF;

				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_type') THEN
					CREATE TYPE "trip_type" AS ENUM ('day_trip', 'overnight');
				END IF;

				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waypoint_type') THEN
					CREATE TYPE "waypoint_type" AS ENUM (
						'start',
						'checkpoint',
						'rest',
						'meal',
						'activity',
						'overnight',
						'finish'
					);
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "trips" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"host_id" uuid NOT NULL,
				"route_id" uuid NOT NULL,
				"title" varchar(150) NOT NULL,
				"description" text,
				"cover_image_url" varchar(500),
				"itinerary" jsonb,
				"includes" jsonb,
				"excludes" jsonb,
				"trip_type" "trip_type" NOT NULL,
				"duration_nights" integer NOT NULL,
				"starts_at" timestamptz NOT NULL,
				"ends_at" timestamptz NOT NULL,
				"meeting_point" geography(Point,4326) NOT NULL,
				"meeting_at" timestamptz,
				"booking_deadline" timestamptz NOT NULL,
				"capacity_min" integer NOT NULL,
				"capacity_max" integer NOT NULL,
				"seats_taken" integer NOT NULL DEFAULT 0,
				"price_per_person" numeric(12,2) NOT NULL,
				"cancellation_policy" jsonb,
				"status" "trip_status" NOT NULL DEFAULT 'draft',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trips_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_trips_host_id" FOREIGN KEY ("host_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_trips_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_trips_schedule" CHECK ("starts_at" < "ends_at"),
				CONSTRAINT "CHK_trips_booking_deadline" CHECK ("booking_deadline" < "starts_at"),
				CONSTRAINT "CHK_trips_meeting_at" CHECK ("meeting_at" IS NULL OR "meeting_at" <= "starts_at"),
				CONSTRAINT "CHK_trips_capacity_min" CHECK ("capacity_min" > 0),
				CONSTRAINT "CHK_trips_capacity_order" CHECK ("capacity_min" <= "capacity_max"),
				CONSTRAINT "CHK_trips_seats_taken" CHECK ("seats_taken" >= 0 AND "seats_taken" <= "capacity_max"),
				CONSTRAINT "CHK_trips_price" CHECK ("price_per_person" >= 0),
				CONSTRAINT "CHK_trips_duration_by_type" CHECK (
					("trip_type" = 'day_trip' AND "duration_nights" = 0)
					OR ("trip_type" = 'overnight' AND "duration_nights" > 0)
				)
			)
		`);

		await queryRunner.query(`
			DO $$
			BEGIN
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "route_id" uuid;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "description" text;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cover_image_url" varchar(500);
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "itinerary" jsonb;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "includes" jsonb;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "excludes" jsonb;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "trip_type" "trip_type" NOT NULL DEFAULT 'day_trip';
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "duration_nights" integer NOT NULL DEFAULT 0;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "starts_at" timestamptz NOT NULL DEFAULT now();
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "ends_at" timestamptz NOT NULL DEFAULT now() + interval '1 hour';
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "meeting_point" geography(Point,4326) NOT NULL
					DEFAULT ST_SetSRID(ST_MakePoint(108.2208, 16.0471), 4326)::geography;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "meeting_at" timestamptz;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "booking_deadline" timestamptz NOT NULL DEFAULT now();
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "capacity_min" integer NOT NULL DEFAULT 1;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "capacity_max" integer NOT NULL DEFAULT 1;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "seats_taken" integer NOT NULL DEFAULT 0;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "price_per_person" numeric(12,2) NOT NULL DEFAULT 0;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cancellation_policy" jsonb;
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "status" "trip_status" NOT NULL DEFAULT 'draft';
				ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

				ALTER TABLE "trips" ALTER COLUMN "title" TYPE varchar(150);
				IF NOT EXISTS (SELECT 1 FROM "trips" WHERE "route_id" IS NULL) THEN
					ALTER TABLE "trips" ALTER COLUMN "route_id" SET NOT NULL;
				END IF;

				ALTER TABLE "trips" ALTER COLUMN "trip_type" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "duration_nights" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "starts_at" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "ends_at" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "meeting_point" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "booking_deadline" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "capacity_min" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "capacity_max" DROP DEFAULT;
				ALTER TABLE "trips" ALTER COLUMN "price_per_person" DROP DEFAULT;

				ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "FK_trips_route_id";
				ALTER TABLE "trips"
					ADD CONSTRAINT "FK_trips_route_id"
					FOREIGN KEY ("route_id") REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT;

				IF NOT EXISTS (
					SELECT 1
					FROM pg_constraint
					WHERE conname = 'FK_trips_host_id'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "FK_trips_host_id"
						FOREIGN KEY ("host_id") REFERENCES "users" ("id") ON DELETE RESTRICT;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_schedule'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_schedule"
						CHECK ("starts_at" < "ends_at") NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_booking_deadline'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_booking_deadline"
						CHECK ("booking_deadline" < "starts_at") NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_meeting_at'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_meeting_at"
						CHECK ("meeting_at" IS NULL OR "meeting_at" <= "starts_at") NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_capacity_min'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_capacity_min" CHECK ("capacity_min" > 0) NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_capacity_order'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_capacity_order"
						CHECK ("capacity_min" <= "capacity_max") NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_seats_taken'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_seats_taken"
						CHECK ("seats_taken" >= 0 AND "seats_taken" <= "capacity_max") NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_price'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_price" CHECK ("price_per_person" >= 0) NOT VALID;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM pg_constraint
					WHERE conname = 'CHK_trips_duration_by_type'
						AND conrelid = 'public.trips'::regclass
				) THEN
					ALTER TABLE "trips"
						ADD CONSTRAINT "CHK_trips_duration_by_type"
						CHECK (
							("trip_type" = 'day_trip' AND "duration_nights" = 0)
							OR ("trip_type" = 'overnight' AND "duration_nights" > 0)
						) NOT VALID;
				END IF;
			END $$;
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "trip_waypoints" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"checkpoint_id" uuid,
				"type" "waypoint_type" NOT NULL,
				"name" varchar(150) NOT NULL,
				"location" geography(Point,4326) NOT NULL,
				"day_number" integer NOT NULL,
				"sequence_order" integer NOT NULL,
				"planned_at" timestamptz,
				"duration_minutes" integer,
				"metadata" jsonb,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trip_waypoints_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_trip_waypoints_trip_id" FOREIGN KEY ("trip_id")
					REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_waypoints_checkpoint_id" FOREIGN KEY ("checkpoint_id")
					REFERENCES "checkpoints" ("id") ON DELETE SET NULL,
				CONSTRAINT "UQ_trip_waypoints_trip_sequence" UNIQUE ("trip_id", "sequence_order"),
				CONSTRAINT "CHK_trip_waypoints_day_number" CHECK ("day_number" > 0),
				CONSTRAINT "CHK_trip_waypoints_sequence_order" CHECK ("sequence_order" > 0),
				CONSTRAINT "CHK_trip_waypoints_duration_minutes" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0)
			)
		`);

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trips_host_id" ON "trips" ("host_id")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trips_route_id" ON "trips" ("route_id")`
		);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_trips_status" ON "trips" ("status")`);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trips_start" ON "trips" ("starts_at")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trips_meeting_point" ON "trips" USING GIST ("meeting_point")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trip_waypoints_trip_order" ON "trip_waypoints" ("trip_id", "sequence_order")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trip_waypoints_checkpoint_id" ON "trip_waypoints" ("checkpoint_id")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_trip_waypoints_location" ON "trip_waypoints" USING GIST ("location")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trip_waypoints_location"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trip_waypoints_checkpoint_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trip_waypoints_trip_order"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_meeting_point"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_start"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_status"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_route_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trips_host_id"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "trip_waypoints"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "trips"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "waypoint_type"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trip_type"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "trip_status"`);
	}
}

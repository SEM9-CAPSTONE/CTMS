import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHealthProfilesTable1786400000000 implements MigrationInterface {
	name = "CreateHealthProfilesTable1786400000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "health_profiles_blood_type_enum" AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN')`
		);
		await queryRunner.query(
			`CREATE TYPE "health_profiles_fitness_level_enum" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')`
		);

		await queryRunner.query(`
			CREATE TABLE "health_profiles" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"user_id" uuid NOT NULL,
				"blood_type" "health_profiles_blood_type_enum" NOT NULL DEFAULT 'UNKNOWN',
				"physical_fitness_level" "health_profiles_fitness_level_enum" NOT NULL DEFAULT 'BEGINNER',
				"dietary_restrictions" varchar(300),
				"emergency_notes" varchar(500),
				"allergies" jsonb NOT NULL DEFAULT '[]',
				"medical_conditions" jsonb NOT NULL DEFAULT '[]',
				"is_consent_granted" boolean NOT NULL DEFAULT false,
				"consent_granted_at" timestamptz,
				"consent_revoked_at" timestamptz,
				"version" integer NOT NULL DEFAULT 1,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_health_profiles_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_health_profiles_user_id" UNIQUE ("user_id"),
				CONSTRAINT "FK_health_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);

		// Index user_id since we lookup health profile by user_id
		await queryRunner.query(
			`CREATE INDEX "IDX_health_profiles_user_id" ON "health_profiles" ("user_id")`
		);

		// Lightweight Mock Tables for Trips, Porter assignments, and bookings
		await queryRunner.query(`
			CREATE TABLE "trips" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"title" varchar(100) NOT NULL,
				"host_id" uuid NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_trips_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_trips_host_id" FOREIGN KEY ("host_id") REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "trip_porters" (
				"trip_id" uuid NOT NULL,
				"porter_id" uuid NOT NULL,
				CONSTRAINT "PK_trip_porters" PRIMARY KEY ("trip_id", "porter_id"),
				CONSTRAINT "FK_trip_porters_trip_id" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_trip_porters_porter_id" FOREIGN KEY ("porter_id") REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);

		await queryRunner.query(`
			CREATE TABLE "bookings" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"trip_id" uuid NOT NULL,
				"user_id" uuid NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_bookings_trip_id" FOREIGN KEY ("trip_id") REFERENCES "trips" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_bookings_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "bookings"`);
		await queryRunner.query(`DROP TABLE "trip_porters"`);
		await queryRunner.query(`DROP TABLE "trips"`);
		await queryRunner.query(`DROP INDEX "IDX_health_profiles_user_id"`);
		await queryRunner.query(`DROP TABLE "health_profiles"`);
		await queryRunner.query(`DROP TYPE "health_profiles_fitness_level_enum"`);
		await queryRunner.query(`DROP TYPE "health_profiles_blood_type_enum"`);
	}
}

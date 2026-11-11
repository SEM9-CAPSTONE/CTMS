import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePorterProfilesAndRouteQualifications1787170000000 implements MigrationInterface {
	name = "CreatePorterProfilesAndRouteQualifications1787170000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "porter_availability_status" AS ENUM ('available', 'unavailable')`
		);
		await queryRunner.query(
			`CREATE TYPE "porter_route_proficiency" AS ENUM ('learning', 'proficient', 'expert')`
		);
		await queryRunner.query(`
			CREATE TABLE "porter_profiles" (
				"porter_id" uuid NOT NULL,
				"experience_years" integer NOT NULL DEFAULT 0,
				"certifications" text[] NOT NULL DEFAULT '{}',
				"languages" text[] NOT NULL DEFAULT '{}',
				"availability_status" "porter_availability_status" NOT NULL DEFAULT 'unavailable',
				"rating_avg" numeric(3,2) NOT NULL DEFAULT 0,
				"completed_trips" integer NOT NULL DEFAULT 0,
				"version" integer NOT NULL DEFAULT 1,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_porter_profiles_porter_id" PRIMARY KEY ("porter_id"),
				CONSTRAINT "FK_porter_profiles_porter_id" FOREIGN KEY ("porter_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "CHK_porter_profiles_experience_years" CHECK ("experience_years" >= 0),
				CONSTRAINT "CHK_porter_profiles_rating_avg" CHECK ("rating_avg" >= 0 AND "rating_avg" <= 5),
				CONSTRAINT "CHK_porter_profiles_completed_trips" CHECK ("completed_trips" >= 0),
				CONSTRAINT "CHK_porter_profiles_version" CHECK ("version" >= 1),
				CONSTRAINT "CHK_porter_profiles_certifications_count" CHECK (cardinality("certifications") <= 20),
				CONSTRAINT "CHK_porter_profiles_languages_count" CHECK (cardinality("languages") <= 20)
			)
		`);
		await queryRunner.query(`
			CREATE TABLE "porter_route_qualifications" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"porter_id" uuid NOT NULL,
				"route_id" uuid NOT NULL,
				"proficiency" "porter_route_proficiency" NOT NULL,
				"times_led" integer NOT NULL DEFAULT 0,
				"verified_by" uuid,
				"verified_at" timestamptz,
				"version" integer NOT NULL DEFAULT 1,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_porter_route_qualifications_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_porter_route_qualifications_porter_id" FOREIGN KEY ("porter_id")
					REFERENCES "users" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_porter_route_qualifications_route_id" FOREIGN KEY ("route_id")
					REFERENCES "trekking_routes" ("id") ON DELETE RESTRICT,
				CONSTRAINT "FK_porter_route_qualifications_verified_by" FOREIGN KEY ("verified_by")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_porter_route_qualifications_times_led" CHECK ("times_led" >= 0),
				CONSTRAINT "CHK_porter_route_qualifications_version" CHECK ("version" >= 1),
				CONSTRAINT "CHK_porter_route_qualifications_verification_pair" CHECK (
					("verified_by" IS NULL AND "verified_at" IS NULL)
					OR ("verified_by" IS NOT NULL AND "verified_at" IS NOT NULL)
				),
				CONSTRAINT "UQ_porter_route_qualifications_porter_route"
					UNIQUE ("porter_id", "route_id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_porter_route_qualifications_route_id" ON "porter_route_qualifications" ("route_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_porter_route_qualifications_route_id"`);
		await queryRunner.query(`DROP TABLE "porter_route_qualifications"`);
		await queryRunner.query(`DROP TABLE "porter_profiles"`);
		await queryRunner.query(`DROP TYPE "porter_route_proficiency"`);
		await queryRunner.query(`DROP TYPE "porter_availability_status"`);
	}
}

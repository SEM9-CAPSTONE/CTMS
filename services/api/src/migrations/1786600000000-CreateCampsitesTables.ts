import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-17-T01 (CTMS-77). Minimal Campsite/Zone/CampsiteImage schema --
 * only what `GET /campsites` (Search Campsites) needs. This is a
 * provisional data model: CTMS-50 (Create/manage Campsite, owned by
 * another teammate, not yet merged) is the real source of truth for the
 * full Campsite domain and may require reconciling this schema (extra
 * columns for description/policies/operating_hours beyond what search
 * reads, zone capacity semantics, image metadata, etc.) once it lands.
 * Column set deliberately kept to what CTMS-17's AC/BRs actually need:
 * status (BR-045/047), province/city + amenities + base_price (BR-046),
 * a representative/cover image (BR-048), ownership via host_id (BR-204
 * context, not enforced by search itself).
 */
export class CreateCampsitesTables1786600000000 implements MigrationInterface {
	name = "CreateCampsitesTables1786600000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// BR-045: "draft"/"pending_approval"/"active"/"suspended"/"closed"/
		// "archived" only -- there is no "rejected" value in this enum, by
		// design (CTMS-16's rejection flow returns a campsite to "draft").
		await queryRunner.query(
			`CREATE TYPE "campsites_status_enum" AS ENUM ('draft', 'pending_approval', 'active', 'suspended', 'closed', 'archived')`
		);

		await queryRunner.query(`
			CREATE TABLE "campsites" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"host_id" uuid NOT NULL,
				"name" varchar(150) NOT NULL,
				"description" varchar(2000) NOT NULL,
				"latitude" numeric(9,6) NOT NULL,
				"longitude" numeric(9,6) NOT NULL,
				"province" varchar(100) NOT NULL,
				"city" varchar(100) NOT NULL,
				"policies" varchar(2000) NOT NULL,
				"operating_hours" varchar(200) NOT NULL,
				"status" "campsites_status_enum" NOT NULL DEFAULT 'draft',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_campsites_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_campsites_host_id" FOREIGN KEY ("host_id") REFERENCES "users" ("id") ON DELETE CASCADE
			)
		`);

		// Search always filters status = 'active' (BR-047/234) and commonly
		// filters/sorts by province+city (BR-046) -- index both access paths.
		await queryRunner.query(`CREATE INDEX "IDX_campsites_status" ON "campsites" ("status")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_campsites_province_city" ON "campsites" ("province", "city")`
		);

		await queryRunner.query(`CREATE TYPE "zones_status_enum" AS ENUM ('active', 'closed')`);

		await queryRunner.query(`
			CREATE TABLE "zones" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"campsite_id" uuid NOT NULL,
				"name" varchar(150) NOT NULL,
				"capacity" integer NOT NULL,
				"location" varchar(200) NOT NULL,
				"base_price" numeric(12,2) NOT NULL,
				"amenities" text[] NOT NULL DEFAULT '{}',
				"status" "zones_status_enum" NOT NULL DEFAULT 'active',
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_zones_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_zones_campsite_id" FOREIGN KEY ("campsite_id") REFERENCES "campsites" ("id") ON DELETE CASCADE
			)
		`);

		await queryRunner.query(`CREATE INDEX "IDX_zones_campsite_id" ON "zones" ("campsite_id")`);
		await queryRunner.query(`CREATE INDEX "IDX_zones_base_price" ON "zones" ("base_price")`);
		// GIN index for the amenities-overlap ("&&") filter query.
		await queryRunner.query(
			`CREATE INDEX "IDX_zones_amenities" ON "zones" USING GIN ("amenities")`
		);

		await queryRunner.query(`
			CREATE TABLE "campsite_images" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"campsite_id" uuid NOT NULL,
				"url" varchar(2000) NOT NULL,
				"type" varchar(50) NOT NULL DEFAULT 'photo',
				"display_order" integer NOT NULL DEFAULT 0,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_campsite_images_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_campsite_images_campsite_id" FOREIGN KEY ("campsite_id") REFERENCES "campsites" ("id") ON DELETE CASCADE
			)
		`);

		// The cover image for a campsite is its lowest display_order row --
		// index the pair so that lookup is a plain index scan, not a sort.
		await queryRunner.query(
			`CREATE INDEX "IDX_campsite_images_campsite_id_order" ON "campsite_images" ("campsite_id", "display_order")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_campsite_images_campsite_id_order"`);
		await queryRunner.query(`DROP TABLE "campsite_images"`);
		await queryRunner.query(`DROP INDEX "IDX_zones_amenities"`);
		await queryRunner.query(`DROP INDEX "IDX_zones_base_price"`);
		await queryRunner.query(`DROP INDEX "IDX_zones_campsite_id"`);
		await queryRunner.query(`DROP TABLE "zones"`);
		await queryRunner.query(`DROP TYPE "zones_status_enum"`);
		await queryRunner.query(`DROP INDEX "IDX_campsites_province_city"`);
		await queryRunner.query(`DROP INDEX "IDX_campsites_status"`);
		await queryRunner.query(`DROP TABLE "campsites"`);
		await queryRunner.query(`DROP TYPE "campsites_status_enum"`);
	}
}

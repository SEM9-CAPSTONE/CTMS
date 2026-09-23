import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEquipmentCatalogTable1787080000000 implements MigrationInterface {
	name = "CreateEquipmentCatalogTable1787080000000";

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "equipment_catalog_status_enum" AS ENUM ('active', 'inactive', 'retired')`
		);
		await queryRunner.query(`
			CREATE TABLE "equipment_catalog_items" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"host_id" uuid NOT NULL,
				"name" varchar(150) NOT NULL,
				"category" varchar(100) NOT NULL,
				"quantity_total" integer NOT NULL,
				"rental_price_per_day" numeric(12,2) NOT NULL,
				"status" "equipment_catalog_status_enum" NOT NULL DEFAULT 'active',
				"maintenance_schedule" varchar(500),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				"updated_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_equipment_catalog_items_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_equipment_catalog_items_host_id" FOREIGN KEY ("host_id")
					REFERENCES "users" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_equipment_catalog_items_name"
					CHECK ("name" <> '' AND "name" !~ '^[[:space:]]|[[:space:]]$'),
				CONSTRAINT "CHK_equipment_catalog_items_category"
					CHECK ("category" <> '' AND "category" !~ '^[[:space:]]|[[:space:]]$'),
				CONSTRAINT "CHK_equipment_catalog_items_quantity_total" CHECK ("quantity_total" >= 0),
				CONSTRAINT "CHK_equipment_catalog_items_rental_price_per_day" CHECK ("rental_price_per_day" >= 0)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_equipment_catalog_items_host_id" ON "equipment_catalog_items" ("host_id")`
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_equipment_catalog_items_host_id"`);
		await queryRunner.query(`DROP TABLE "equipment_catalog_items"`);
		await queryRunner.query(`DROP TYPE "equipment_catalog_status_enum"`);
	}
}

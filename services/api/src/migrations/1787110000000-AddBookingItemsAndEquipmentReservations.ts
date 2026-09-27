import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingItemsAndEquipmentReservations1787110000000 implements MigrationInterface {
	name = "AddBookingItemsAndEquipmentReservations1787110000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "bookings" ADD COLUMN "total_amount" numeric(12,2)
		`);
		await queryRunner.query(`
			ALTER TABLE "bookings"
				ADD CONSTRAINT "CHK_bookings_total_amount"
					CHECK ("total_amount" IS NULL OR "total_amount" >= 0)
		`);

		await queryRunner.query(`CREATE TYPE "booking_item_type" AS ENUM ('equipment')`);
		await queryRunner.query(`
			CREATE TABLE "booking_items" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"booking_id" uuid NOT NULL,
				"item_type" "booking_item_type" NOT NULL,
				"equipment_catalog_item_id" uuid NOT NULL,
				"quantity" integer NOT NULL,
				"unit_price" numeric(12,2) NOT NULL,
				"rental_days" integer NOT NULL,
				"total_price" numeric(12,2) NOT NULL,
				"idempotency_key" varchar(128),
				"request_fingerprint" varchar(64),
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_booking_items_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_booking_items_booking_id" FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_booking_items_equipment_catalog_item_id" FOREIGN KEY ("equipment_catalog_item_id")
					REFERENCES "equipment_catalog_items" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_booking_items_quantity" CHECK ("quantity" > 0),
				CONSTRAINT "CHK_booking_items_unit_price" CHECK ("unit_price" >= 0),
				CONSTRAINT "CHK_booking_items_rental_days" CHECK ("rental_days" > 0),
				CONSTRAINT "CHK_booking_items_total_price" CHECK ("total_price" >= 0),
				CONSTRAINT "CHK_booking_items_idempotency_fingerprint"
					CHECK (
						("idempotency_key" IS NULL AND "request_fingerprint" IS NULL)
						OR ("idempotency_key" IS NOT NULL AND "request_fingerprint" IS NOT NULL)
					)
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_booking_items_booking_id" ON "booking_items" ("booking_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_booking_items_equipment_catalog_item_id" ON "booking_items" ("equipment_catalog_item_id")`
		);
		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_booking_items_booking_id_idempotency_key"
			ON "booking_items" ("booking_id", "idempotency_key")
			WHERE "idempotency_key" IS NOT NULL
		`);

		await queryRunner.query(`
			CREATE TABLE "equipment_reservations" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"booking_item_id" uuid NOT NULL,
				"equipment_catalog_item_id" uuid NOT NULL,
				"quantity" integer NOT NULL,
				"rental_start_date" date NOT NULL,
				"rental_end_date" date NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_equipment_reservations_id" PRIMARY KEY ("id"),
				CONSTRAINT "UQ_equipment_reservations_booking_item_id" UNIQUE ("booking_item_id"),
				CONSTRAINT "FK_equipment_reservations_booking_item_id" FOREIGN KEY ("booking_item_id")
					REFERENCES "booking_items" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_equipment_reservations_equipment_catalog_item_id" FOREIGN KEY ("equipment_catalog_item_id")
					REFERENCES "equipment_catalog_items" ("id") ON DELETE RESTRICT,
				CONSTRAINT "CHK_equipment_reservations_quantity" CHECK ("quantity" > 0),
				CONSTRAINT "CHK_equipment_reservations_date_range"
					CHECK ("rental_end_date" >= "rental_start_date")
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_equipment_reservations_item_dates"
			ON "equipment_reservations" ("equipment_catalog_item_id", "rental_start_date", "rental_end_date")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_equipment_reservations_item_dates"`);
		await queryRunner.query(`DROP TABLE "equipment_reservations"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_booking_items_booking_id_idempotency_key"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_booking_items_equipment_catalog_item_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_booking_items_booking_id"`);
		await queryRunner.query(`DROP TABLE "booking_items"`);
		await queryRunner.query(`DROP TYPE IF EXISTS "booking_item_type"`);
		await queryRunner.query(`
			ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "CHK_bookings_total_amount"
		`);
		await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN IF EXISTS "total_amount"`);
	}
}

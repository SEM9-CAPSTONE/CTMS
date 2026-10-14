import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePackingListGenerations1787230000000 implements MigrationInterface {
	name = "CreatePackingListGenerations1787230000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "packing_list_generations" (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"booking_id" uuid NOT NULL,
				"generated_from" jsonb NOT NULL,
				"input_fingerprint" varchar(64) NOT NULL,
				"created_at" timestamptz NOT NULL DEFAULT now(),
				CONSTRAINT "PK_packing_list_generations_id" PRIMARY KEY ("id"),
				CONSTRAINT "FK_packing_list_generations_booking_id" FOREIGN KEY ("booking_id")
					REFERENCES "bookings" ("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_packing_list_generations_booking_fingerprint"
					UNIQUE ("booking_id", "input_fingerprint")
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "packing_list_generations"`);
	}
}

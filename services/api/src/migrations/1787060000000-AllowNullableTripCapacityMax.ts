import type { MigrationInterface, QueryRunner } from "typeorm";

export class AllowNullableTripCapacityMax1787060000000 implements MigrationInterface {
	name = "AllowNullableTripCapacityMax1787060000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "CHK_trips_capacity_order";
			ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "CHK_trips_seats_taken";
			ALTER TABLE "trips" ALTER COLUMN "capacity_max" DROP NOT NULL;
			ALTER TABLE "trips"
				ADD CONSTRAINT "CHK_trips_capacity_order"
				CHECK ("capacity_max" IS NULL OR "capacity_min" <= "capacity_max");
			ALTER TABLE "trips"
				ADD CONSTRAINT "CHK_trips_seats_taken"
				CHECK ("seats_taken" >= 0 AND ("capacity_max" IS NULL OR "seats_taken" <= "capacity_max"));
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			UPDATE "trips" SET "capacity_max" = "capacity_min" WHERE "capacity_max" IS NULL;
			ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "CHK_trips_capacity_order";
			ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "CHK_trips_seats_taken";
			ALTER TABLE "trips" ALTER COLUMN "capacity_max" SET NOT NULL;
			ALTER TABLE "trips"
				ADD CONSTRAINT "CHK_trips_capacity_order"
				CHECK ("capacity_min" <= "capacity_max");
			ALTER TABLE "trips"
				ADD CONSTRAINT "CHK_trips_seats_taken"
				CHECK ("seats_taken" >= 0 AND "seats_taken" <= "capacity_max");
		`);
	}
}

import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CTMS-024 – Prevent Trip Overbooking
 *
 * Schema changes:
 *  1. Drops the old CHK_trips_seats_taken constraint and replaces it with an
 *     identical idempotent version so the DB always mirrors application intent:
 *     seats_taken >= 0 AND (capacity_max IS NULL OR seats_taken <= capacity_max).
 *
 *  2. Creates `recompute_trip_seats_taken(p_trip_id uuid)` – the single
 *     reconciliation function used after cancel/expire/rollback scenarios
 *     (BR-067, BR-069, BR-070).  Counts only bookings in confirmed or
 *     pending_payment status.  PL/pgSQL uses late binding so the bookings
 *     table may not yet exist at migration time.
 *
 *  3. Conditionally creates a covering index on bookings(trip_id, status)
 *     INCLUDE (num_people) to accelerate the recompute subquery (BR-068).
 */
export class PreventTripOverbooking1787090000000 implements MigrationInterface {
	name = "PreventTripOverbooking1787090000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// 1. Refresh the seats_taken check constraint (idempotent).
		await queryRunner.query(`
			ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "CHK_trips_seats_taken";
			ALTER TABLE "trips"
				ADD CONSTRAINT "CHK_trips_seats_taken"
				CHECK ("seats_taken" >= 0 AND ("capacity_max" IS NULL OR "seats_taken" <= "capacity_max"));
		`);

		// 2. Recompute helper function (BR-069, BR-070).
		await queryRunner.query(`
			CREATE OR REPLACE FUNCTION recompute_trip_seats_taken(p_trip_id uuid)
			RETURNS void
			LANGUAGE plpgsql
			AS $$
			DECLARE
				v_computed integer;
			BEGIN
				SELECT COALESCE(SUM(b.num_people), 0)
				INTO v_computed
				FROM bookings b
				WHERE b.trip_id = p_trip_id
				  AND b.status IN ('confirmed', 'pending_payment');

				UPDATE trips
				SET seats_taken = v_computed,
				    updated_at  = now()
				WHERE id = p_trip_id;
			END;
			$$;
		`);

		// 3. Covering index on bookings for recompute subquery (BR-068).
		//    Only created if the bookings table already exists (CTMS-021
		//    dependency).
		await queryRunner.query(`
			DO $$
			BEGIN
				IF EXISTS (
					SELECT 1 FROM information_schema.tables
					WHERE table_name = 'bookings'
				) AND NOT EXISTS (
					SELECT 1 FROM pg_indexes
					WHERE tablename = 'bookings'
					AND   indexname = 'IDX_bookings_trip_id_status_num_people'
				) THEN
					CREATE INDEX "IDX_bookings_trip_id_status_num_people"
					ON "bookings" ("trip_id", "status")
					INCLUDE ("num_people");
				END IF;
			END $$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP INDEX IF EXISTS "IDX_bookings_trip_id_status_num_people";
			DROP FUNCTION IF EXISTS recompute_trip_seats_taken(uuid);
			ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "CHK_trips_seats_taken";
			ALTER TABLE "trips"
				ADD CONSTRAINT "CHK_trips_seats_taken"
				CHECK ("seats_taken" >= 0 AND ("capacity_max" IS NULL OR "seats_taken" <= "capacity_max"));
		`);
	}
}

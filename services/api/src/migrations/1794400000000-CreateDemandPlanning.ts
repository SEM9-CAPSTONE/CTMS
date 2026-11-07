import type { MigrationInterface, QueryRunner } from "typeorm";
export class CreateDemandPlanning1794400000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`CREATE TABLE demand_areas(code varchar(40) PRIMARY KEY CHECK(code ~ '^[a-z0-9][a-z0-9-]{1,39}$'),label varchar(80) NOT NULL,active boolean NOT NULL DEFAULT true);
 CREATE TABLE trip_demand_contexts(trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,area_code varchar(40) NOT NULL REFERENCES demand_areas(code),confirmed_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE booking_demand_snapshots(booking_id uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,trip_type text NOT NULL,difficulty text NOT NULL,price_band text,capacity_band text,duration_band text,area_code varchar(40) REFERENCES demand_areas(code),snapshot_version text NOT NULL DEFAULT 'booking-v1',captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
 CREATE FUNCTION capture_booking_demand_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF abs(extract(epoch FROM (clock_timestamp()-NEW.created_at)))>300 THEN RETURN NEW; END IF;
 INSERT INTO booking_demand_snapshots(booking_id,trip_type,difficulty,price_band,capacity_band,duration_band,area_code)
 SELECT NEW.id,t.trip_type::text,r.difficulty::text,
 CASE WHEN NEW.base_price IS NULL OR NEW.num_people IS NULL OR NEW.num_people<=0 OR NEW.base_price<>t.price_per_person*NEW.num_people THEN NULL WHEN t.price_per_person=0 THEN 'free' WHEN t.price_per_person>0 AND t.price_per_person<500000 THEN 'under_500k' WHEN t.price_per_person>=500000 AND t.price_per_person<1000000 THEN '500k_to_1m' WHEN t.price_per_person>=1000000 THEN '1m_plus' END,
 CASE WHEN t.capacity_max BETWEEN 1 AND 10 THEN '1_to_10' WHEN t.capacity_max BETWEEN 11 AND 20 THEN '11_to_20' WHEN t.capacity_max BETWEEN 21 AND 40 THEN '21_to_40' WHEN t.capacity_max>40 THEN '41_plus' END,
 CASE WHEN t.duration_nights=0 THEN 'day' WHEN t.duration_nights=1 THEN 'one_night' WHEN t.duration_nights>1 THEN 'two_plus_nights' END,
 CASE WHEN a.active THEN a.code END
 FROM trips t JOIN trekking_routes r ON r.id=t.route_id LEFT JOIN trip_demand_contexts c ON c.trip_id=t.id LEFT JOIN demand_areas a ON a.code=c.area_code WHERE t.id=NEW.trip_id;
 RETURN NEW; END $$;
 CREATE TRIGGER booking_demand_capture AFTER INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION capture_booking_demand_snapshot();
 CREATE FUNCTION reject_booking_demand_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Booking demand snapshots are immutable'; END $$;
 CREATE TRIGGER booking_demand_immutable BEFORE UPDATE ON booking_demand_snapshots FOR EACH ROW EXECUTE FUNCTION reject_booking_demand_snapshot_update();
 CREATE TABLE demand_planning_contexts(report_id uuid PRIMARY KEY REFERENCES demand_insight_reports(id) ON DELETE CASCADE,source_hash text NOT NULL,context jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE demand_planning_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL UNIQUE REFERENCES demand_insight_reports(id) ON DELETE CASCADE,configuration jsonb NOT NULL,status text NOT NULL CHECK(status IN ('pending','running','succeeded','failed')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),output jsonb NOT NULL DEFAULT '[]',error_code text,generated_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
 CREATE INDEX demand_planning_work ON demand_planning_jobs(next_attempt_at,created_at) WHERE status IN ('pending','running');
 CREATE TABLE demand_planning_control(id integer PRIMARY KEY CHECK(id=1),last_created_at timestamptz); INSERT INTO demand_planning_control VALUES(1,NULL);`);
	}
	async down(q: QueryRunner): Promise<void> {
		await q.query(
			"DROP TABLE demand_planning_jobs,demand_planning_contexts,demand_planning_control; DROP TRIGGER booking_demand_capture ON bookings; DROP FUNCTION capture_booking_demand_snapshot(); DROP TABLE booking_demand_snapshots; DROP FUNCTION reject_booking_demand_snapshot_update(); DROP TABLE trip_demand_contexts,demand_areas;"
		);
	}
}

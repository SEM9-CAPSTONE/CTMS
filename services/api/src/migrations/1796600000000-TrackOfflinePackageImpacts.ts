import type { MigrationInterface, QueryRunner } from "typeorm";

/** Core changes and their publication requests share the writer's transaction. */
export class TrackOfflinePackageImpacts1796600000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
		 CREATE TABLE offline_package_impacts (
		   trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		   source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 1 AND 1000),
		   job_id uuid REFERENCES offline_package_jobs(id) ON DELETE CASCADE,
		   change_context jsonb NOT NULL DEFAULT '{}',
		   recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
		   PRIMARY KEY(trip_id,source_reference)
		 );
		 CREATE INDEX offline_package_impacts_pending
		   ON offline_package_impacts(recorded_at,trip_id,source_reference) WHERE job_id IS NULL;
		 CREATE INDEX offline_package_impact_job ON offline_package_impacts(job_id);
		 CREATE FUNCTION capture_offline_package_core_change() RETURNS trigger LANGUAGE plpgsql AS $$
		 DECLARE route_ids uuid[]; trip_ids uuid[]; source_ref text; entity_id uuid;
		 BEGIN
		   IF TG_TABLE_NAME = 'trekking_routes' THEN
		     IF ST_AsEWKB(OLD.route_geom::geometry) IS NOT DISTINCT FROM ST_AsEWKB(NEW.route_geom::geometry) THEN
		       RETURN NULL;
		     END IF;
		     route_ids := ARRAY[NEW.id];
		   ELSIF TG_TABLE_NAME = 'checkpoints' THEN
		     IF current_setting('ctms.package_hotspot_correction', true) = 'on' THEN RETURN NULL; END IF;
		     IF TG_OP = 'UPDATE' AND
		       (OLD.route_id,OLD.name,OLD.type,ST_AsEWKB(OLD.location::geometry),OLD.radius_m,
		        OLD.expected_arrival_offset,OLD.instructions,OLD.route_position)
		       IS NOT DISTINCT FROM
		       (NEW.route_id,NEW.name,NEW.type,ST_AsEWKB(NEW.location::geometry),NEW.radius_m,
		        NEW.expected_arrival_offset,NEW.instructions,NEW.route_position) THEN RETURN NULL; END IF;
		     route_ids := CASE TG_OP WHEN 'INSERT' THEN ARRAY[NEW.route_id]
		       WHEN 'DELETE' THEN ARRAY[OLD.route_id] ELSE ARRAY[OLD.route_id,NEW.route_id] END;
		   ELSIF TG_TABLE_NAME = 'trip_waypoints' THEN
		     IF TG_OP = 'UPDATE' AND
		       (OLD.trip_id,OLD.checkpoint_id,OLD.type,OLD.name,ST_AsEWKB(OLD.location::geometry),
		        OLD.day_number,OLD.sequence_order,OLD.planned_at,OLD.duration_minutes)
		       IS NOT DISTINCT FROM
		       (NEW.trip_id,NEW.checkpoint_id,NEW.type,NEW.name,ST_AsEWKB(NEW.location::geometry),
		        NEW.day_number,NEW.sequence_order,NEW.planned_at,NEW.duration_minutes) THEN RETURN NULL; END IF;
		     trip_ids := CASE TG_OP WHEN 'INSERT' THEN ARRAY[NEW.trip_id]
		       WHEN 'DELETE' THEN ARRAY[OLD.trip_id] ELSE ARRAY[OLD.trip_id,NEW.trip_id] END;
		   ELSE
		     IF (OLD.route_id,OLD.trip_type,OLD.starts_at,OLD.ends_at) IS NOT DISTINCT FROM
		        (NEW.route_id,NEW.trip_type,NEW.starts_at,NEW.ends_at) THEN RETURN NULL; END IF;
		     trip_ids := ARRAY[NEW.id];
		   END IF;
		   entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
		   source_ref := concat('core:', TG_TABLE_NAME, ':', entity_id, ':', txid_current());
		   INSERT INTO offline_package_impacts(trip_id,source_reference,change_context)
		     SELECT id,source_ref,jsonb_build_object('entity',TG_TABLE_NAME,'operation',TG_OP,
		       'entityId',entity_id,'transaction',txid_current()) FROM trips
		     WHERE status='published' AND (id=ANY(trip_ids) OR route_id=ANY(route_ids))
		     ON CONFLICT DO NOTHING;
		   RETURN NULL;
		 END $$;
		 CREATE TRIGGER offline_package_route_change AFTER UPDATE OF route_geom ON trekking_routes
		   FOR EACH ROW EXECUTE FUNCTION capture_offline_package_core_change();
		 CREATE TRIGGER offline_package_checkpoint_change AFTER INSERT OR UPDATE OR DELETE ON checkpoints
		   FOR EACH ROW EXECUTE FUNCTION capture_offline_package_core_change();
		 CREATE TRIGGER offline_package_waypoint_change AFTER INSERT OR UPDATE OR DELETE ON trip_waypoints
		   FOR EACH ROW EXECUTE FUNCTION capture_offline_package_core_change();
		 CREATE TRIGGER offline_package_trip_change AFTER UPDATE OF route_id,trip_type,starts_at,ends_at ON trips
		   FOR EACH ROW EXECUTE FUNCTION capture_offline_package_core_change();
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`
		 DROP TRIGGER offline_package_trip_change ON trips;
		 DROP TRIGGER offline_package_waypoint_change ON trip_waypoints;
		 DROP TRIGGER offline_package_checkpoint_change ON checkpoints;
		 DROP TRIGGER offline_package_route_change ON trekking_routes;
		 DROP FUNCTION capture_offline_package_core_change();
		 DROP TABLE offline_package_impacts;
		`);
	}
}

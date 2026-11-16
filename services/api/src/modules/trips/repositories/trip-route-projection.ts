import { routeDangerZonesProjection } from "../../trekking-routes/route-danger-zone-projection";

export const TRIP_ROUTE_PROJECTION_SQL = `CASE WHEN route."id" IS NULL THEN NULL ELSE jsonb_build_object(
  'id', route."id", 'name', route."name", 'status', route."status",
  'geometry', ST_AsGeoJSON(route."route_geom")::jsonb, 'updatedAt', route."updated_at",
  'checkpoints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id', cp."id", 'routeId', cp."route_id", 'name', cp."name", 'type', cp."type",
   'location', ST_AsGeoJSON(cp."location")::jsonb, 'radiusMeters', cp."radius_m",
   'expectedArrivalOffset', cp."expected_arrival_offset", 'instructions', cp."instructions",
   'nearbyWaterOrShelter', cp."nearby_water_or_shelter", 'routePosition', cp."route_position",
   'createdAt', cp."created_at", 'updatedAt', cp."updated_at"
  ) ORDER BY cp."route_position", cp."id") FROM "checkpoints" cp WHERE cp."route_id" = route."id"), '[]'::jsonb),
  'dangerZones', ${routeDangerZonesProjection("route")}
 ) END`;

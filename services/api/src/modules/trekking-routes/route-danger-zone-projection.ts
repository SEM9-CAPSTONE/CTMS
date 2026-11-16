/** Only trusted, static route aliases are accepted; never pass request input here. */
export function routeDangerZonesProjection(routeAlias: "route" | "r"): string {
	return `COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id', hazard."id", 'routeId', hazard."route_id", 'geometry', ST_AsGeoJSON(hazard."geom")::jsonb,
   'radiusMeters', hazard."radius_m", 'description', hazard."description", 'severity', hazard."severity",
   'createdAt', hazard."created_at", 'updatedAt', hazard."updated_at"
  ) ORDER BY hazard."id") FROM "route_danger_zones" hazard WHERE hazard."route_id" = ${routeAlias}."id"), '[]'::jsonb)`;
}

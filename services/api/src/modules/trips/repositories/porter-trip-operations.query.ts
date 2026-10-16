// Explicit operational projection: never expose Host, billing, health, or provider payloads.
// Porters only see Trips that are upcoming, ongoing or finished; other lifecycle states stay hidden.
export const PORTER_VISIBLE_TRIP_STATUSES_SQL = "'published', 'ongoing', 'completed'";

// One statement gives assignment authorization and all sections the same database snapshot.
export const PORTER_TRIP_OPERATIONS_QUERY = `
SELECT trip."id" AS "tripId", trip."title", trip."status",
 trip."starts_at" AS "startsAt", trip."ends_at" AS "endsAt",
 trip."meeting_at" AS "meetingAt", ST_AsGeoJSON(trip."meeting_point")::jsonb AS "meetingPoint",
 (SELECT wp."name" FROM "trip_waypoints" wp
  WHERE wp."trip_id" = trip."id" AND ST_DWithin(wp."location", trip."meeting_point", 50)
  ORDER BY ST_Distance(wp."location", trip."meeting_point"), wp."day_number", wp."sequence_order"
  LIMIT 1) AS "meetingPointName",
 COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'id', wp."id", 'name', wp."name", 'type', wp."type", 'dayNumber', wp."day_number",
  'sequenceOrder', wp."sequence_order", 'plannedAt', wp."planned_at",
  'durationMinutes', wp."duration_minutes", 'location', ST_AsGeoJSON(wp."location")::jsonb
 ) ORDER BY wp."day_number", wp."sequence_order", wp."id")
 FROM "trip_waypoints" wp WHERE wp."trip_id" = trip."id"), '[]'::jsonb) AS "waypoints",
 trip."updated_at" AS "updatedAt", assignment."status" AS "assignmentStatus",
 statement_timestamp() AS "retrievedAt",
 CASE WHEN route."id" IS NULL THEN NULL ELSE jsonb_build_object(
  'id', route."id", 'name', route."name", 'status', route."status",
  'geometry', ST_AsGeoJSON(route."route_geom")::jsonb, 'updatedAt', route."updated_at",
  'checkpoints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id', cp."id", 'routeId', cp."route_id", 'name', cp."name", 'type', cp."type",
   'location', ST_AsGeoJSON(cp."location")::jsonb, 'radiusMeters', cp."radius_m",
   'expectedArrivalOffset', cp."expected_arrival_offset", 'instructions', cp."instructions",
   'nearbyWaterOrShelter', cp."nearby_water_or_shelter", 'routePosition', cp."route_position",
   'createdAt', cp."created_at", 'updatedAt', cp."updated_at"
  ) ORDER BY cp."route_position", cp."id") FROM "checkpoints" cp WHERE cp."route_id" = route."id"), '[]'::jsonb),
  'dangerZones', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id', hazard."id", 'routeId', hazard."route_id", 'geometry', ST_AsGeoJSON(hazard."geom")::jsonb,
   'radiusMeters', hazard."radius_m", 'description', hazard."description", 'severity', hazard."severity",
   'createdAt', hazard."created_at", 'updatedAt', hazard."updated_at"
  ) ORDER BY hazard."id") FROM "route_danger_zones" hazard WHERE hazard."route_id" = route."id"), '[]'::jsonb)
 ) END AS "route",
 COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'memberId', member."id", 'displayName', camper."full_name", 'memberStatus', member."member_status"
 ) ORDER BY member."created_at", member."id")
 FROM "booking_members" member JOIN "bookings" booking ON booking."id" = member."booking_id"
 LEFT JOIN "users" camper ON camper."id" = member."user_id"
 WHERE booking."trip_id" = trip."id"
  AND booking."status" IN ('confirmed', 'pending_reconfirmation', 'completed')
  AND member."member_status" IN ('registered', 'joined', 'no_show', 'left')), '[]'::jsonb) AS "members",
 (SELECT jsonb_build_object(
  'status', snapshot."status", 'observedAt', snapshot."observed_at", 'fetchedAt', snapshot."created_at",
  'rainfallMm', snapshot."rainfall_mm", 'windKph', snapshot."wind_kph",
  'temperatureC', snapshot."temperature_c", 'visibilityM', snapshot."visibility_m",
  'thunderstorm', snapshot."thunderstorm",
  'riskLevel', (SELECT risk."risk_level" FROM "weather_risk_assessments" risk
   WHERE risk."snapshot_id" = snapshot."id" AND risk."route_id" = route."id"
   ORDER BY risk."created_at" DESC, risk."id" DESC LIMIT 1)
 ) FROM "weather_snapshots" snapshot WHERE snapshot."route_id" = route."id"
 ORDER BY snapshot."created_at" DESC, snapshot."id" DESC LIMIT 1) AS "recordedWeather"
FROM "trip_porters" assignment
JOIN "trips" trip ON trip."id" = assignment."trip_id"
LEFT JOIN "trekking_routes" route ON route."id" = trip."route_id"
WHERE assignment."porter_id" = $1 AND assignment."status" = 'assigned' AND trip."id" = $2
 AND trip."status" IN (${PORTER_VISIBLE_TRIP_STATUSES_SQL})
`;

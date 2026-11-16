/** CTMS-118's applied Admin decision is the authority; a confirmed candidate alone is insufficient. */
export const VERIFIED_DANGER_ZONES_CTE = `verified_zones AS (
 SELECT z.*, decision.created_at AS approved_at
 FROM route_danger_zones z
 JOIN LATERAL (
  SELECT a.* FROM hotspot_corrective_actions a
  WHERE a.target_type='trekking_route_danger_zone' AND a.target_id=z.id AND a.route_id=z.route_id
   AND a.action_type IN ('ADD_HAZARD_AREA','UPDATE_HAZARD_AREA')
  ORDER BY a.created_at DESC,a.id DESC LIMIT 1
 ) decision ON true
 JOIN potential_safety_hotspots h ON h.id=decision.hotspot_id AND h.route_id=z.route_id
 WHERE h.status='CONFIRMED' AND h.evidence_hash=decision.hotspot_evidence_hash
  AND h.route_version=decision.hotspot_route_version
  AND date_trunc('milliseconds',h.status_changed_at)=date_trunc('milliseconds',decision.hotspot_status_changed_at)
  AND decision.after->>'description'=z.description
  AND decision.after->>'severity'=z.severity::text
  AND decision.after->'geometry'=ST_AsGeoJSON(z.geom::geometry)::jsonb
  AND COALESCE(decision.after->'radiusMeters','null'::jsonb)=COALESCE(to_jsonb(z.radius_m),'null'::jsonb)
)`;

export const VERIFIED_DANGER_ZONE_COLUMNS = `
 'host:' || v.id AS id, 'ADMIN_VERIFIED' AS "sourceType", 'CTMS' AS source,
 v.id::text AS "sourceReference", 'verified_danger_zone' AS "hazardType",
 upper(v.severity::text) AS severity, NULL::text AS "routeName",
 v.geom, 'verified_danger_zone' AS "geometryRole", v.description,
 NULL::timestamptz AS "observedAt", v.approved_at AS "issuedAt", NULL::timestamptz AS "fetchedAt",
 NULL::timestamptz AS "validFrom", NULL::timestamptz AS "validUntil", v.updated_at AS "updatedAt",
 'ACTIVE' AS "lifecycleStatus", 'VERIFIED' AS "verificationStatus", NULL::float8 AS "accuracyMeters",
 v.radius_m AS "radiusMeters", ST_AsGeoJSON(ST_PointOnSurface(v.geom::geometry))::jsonb AS "labelPoint"`;

/**
 * An Admin decision is the authority; a confirmed candidate or a Host report alone is insufficient.
 * The latest decision on a zone is either a CTMS-118 hazard correction (still backed by current
 * CONFIRMED hotspot evidence) or an approved danger-zone proposal. Either way the zone must still
 * match the snapshot the Admin approved, so later unapproved edits are not published.
 */
export const VERIFIED_DANGER_ZONES_CTE = `verified_zones AS (
 SELECT z.*, decision.decided_at AS approved_at, decision.hazard_type AS approved_hazard_type
 FROM route_danger_zones z
 JOIN LATERAL (
  SELECT d.* FROM (
   SELECT a.created_at AS decided_at, a.id, a.after, 'HOTSPOT'::text AS kind, a.hotspot_id,
    a.hotspot_evidence_hash, a.hotspot_route_version, a.hotspot_status_changed_at,
    NULL::text AS hazard_type
   FROM hotspot_corrective_actions a
   WHERE a.target_type='trekking_route_danger_zone' AND a.target_id=z.id AND a.route_id=z.route_id
    AND a.action_type IN ('ADD_HAZARD_AREA','UPDATE_HAZARD_AREA')
   UNION ALL
   SELECT p.reviewed_at, p.id, p.approved_snapshot, 'PROPOSAL'::text, NULL::uuid,
    NULL::char(64), NULL::varchar, NULL::timestamptz, p.hazard_type::text
   FROM danger_zone_proposals p
   WHERE p.danger_zone_id=z.id AND p.route_id=z.route_id AND p.status='APPROVED'
  ) d
  ORDER BY d.decided_at DESC, d.id DESC LIMIT 1
 ) decision ON true
 LEFT JOIN potential_safety_hotspots h
  ON decision.kind='HOTSPOT' AND h.id=decision.hotspot_id AND h.route_id=z.route_id
 WHERE (
   decision.kind='PROPOSAL'
   OR (h.status='CONFIRMED' AND h.evidence_hash=decision.hotspot_evidence_hash
    AND h.route_version=decision.hotspot_route_version
    AND date_trunc('milliseconds',h.status_changed_at)=date_trunc('milliseconds',decision.hotspot_status_changed_at))
  )
  AND decision.after->>'description'=z.description
  AND decision.after->>'severity'=z.severity::text
  AND decision.after->'geometry'=ST_AsGeoJSON(z.geom::geometry)::jsonb
  AND COALESCE(decision.after->'radiusMeters','null'::jsonb)=COALESCE(to_jsonb(z.radius_m),'null'::jsonb)
)`;

export const VERIFIED_DANGER_ZONE_COLUMNS = `
 'host:' || v.id AS id, 'ADMIN_VERIFIED' AS "sourceType", 'CTMS' AS source,
 v.id::text AS "sourceReference",
 COALESCE(v.approved_hazard_type, 'verified_danger_zone') AS "hazardType",
 upper(v.severity::text) AS severity, NULL::text AS "routeName",
 v.geom, 'verified_danger_zone' AS "geometryRole", v.description,
 NULL::timestamptz AS "observedAt", v.approved_at AS "issuedAt", NULL::timestamptz AS "fetchedAt",
 NULL::timestamptz AS "validFrom", NULL::timestamptz AS "validUntil", v.updated_at AS "updatedAt",
 'ACTIVE' AS "lifecycleStatus", 'VERIFIED' AS "verificationStatus", NULL::float8 AS "accuracyMeters",
 v.radius_m AS "radiusMeters", ST_AsGeoJSON(ST_PointOnSurface(v.geom::geometry))::jsonb AS "labelPoint"`;

# CTMS-23 - Manage Route Checkpoints and Hazard Operational Data

**Jira Mapping**

Jira `CTMS-89` implements backlog/spec task `CTMS-23-T01` (backend preparation and logic).

**Spec Reference**  
/file/spec/ctms-23-mark-danger-zones-and-shelters.md

**Status**  
To Do

**Story Title**
Manage Route Checkpoints and Hazard Operational Data

**Story**  
As an owning Host, I want to maintain checkpoint and hazard operational data for internal Route safety so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for owning-Host workflows and for downstream Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Authorized actors can create and update Route hazard areas with polygon geometry, description, and severity.
- [ ] Authorized actors can maintain checkpoints, including type, radius, expected arrival offset, instructions, and nearby water/shelter flag.
- [ ] Operational data is available to Trip planning, offline safety packages, and internal monitoring.
- [ ] Camper-facing exposure happens through published Trip safety/itinerary context, not raw Route browsing.

## Scope

- Route operational safety data.
- Checkpoint/hazard validation and audit.
- Internal reuse across many Trips.

## Out of Scope

- No retired campsite sub-area concept despite old wording around danger areas.
- No public Route detail page.
- No free-form unsafe geometry without validation.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-224, BR-225, BR-052, BR-053, BR-054, BR-232`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `checkpoints` store route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter.
- `route_danger_zones` store id, route_id, geom, nullable radius_m, description, severity,
  created_at, and updated_at. `geom` is PostGIS `geography(Geometry,4326)` constrained to Point or
  Polygon. Point records require a finite positive radius_m; Polygon records require radius_m NULL.
- Danger-zone severity is exactly `low`, `medium`, or `high`. Description is trimmed, required,
  nonblank, and at most 1000 characters.

## State and Validation Rules

- The actor must be an authenticated active Host. The Route must exist and belong to a Campsite
  owned by that Host; this task grants no Admin/System mutation bypass.
- Danger zones may be created only while the Route is `draft`; no automatic Route transition occurs.
- Geometry must be a valid SRID-4326 Point or Polygon within supported coordinate bounds.
- Changes are audited and can trigger Trip/offline package revalidation where implemented.

## Backend Preparation Logic and Tests

### Actor and preconditions

- The primary actor is the authenticated active owning Host. Ownership is derived through
  `route_danger_zones.route_id -> trekking_routes.campsite_id -> campsites.host_id`; owner IDs are
  not duplicated in danger-zone records or accepted from clients.
- Shelter data reuses the existing `checkpoints` model with `type=emergency_shelter`.
  `location` remains `geography(Point,4326)`, and its required safety description maps to the
  existing trimmed `instructions` field with the existing 1000-character maximum.
- A danger zone is a separate record in `route_danger_zones`; a `dangerous` checkpoint is not a
  substitute for it.
- A Point danger zone persists its GeoJSON Point unchanged and maps API `radiusMeters` to the
  required finite positive `radius_m`. A Polygon persists its GeoJSON Polygon with `radius_m` NULL
  and rejects supplied `radiusMeters`.

### Main, alternate, and exception flows

1. `JwtAuthGuard` authenticates an active account and `RolesGuard` requires the Host role.
2. The backend validates UUID path parameters, rejects server-controlled fields, and validates
   geometry, conditional radius, trimmed description, and exact severity.
3. A create mutation starts one transaction, locks the authoritative Route, verifies ownership and
   the approved Route-state rule, persists the danger zone, and inserts its audit record.
4. The transaction commits before returning authoritative SRID-4326 geometry and stored metadata.
5. The nested read returns authoritative danger-zone data for later Route-map and offline-package
   consumers without exposing Host IDs, owner IDs, status, or client-controlled spatial fields.

- A Route with no danger zones returns an empty collection.
- Missing or inactive authentication returns `401`; a non-Host or foreign Host returns `403`; a
  missing Route returns `404`; a non-draft Route returns `409`; malformed UUID,
  body, coordinates, geometry, description, or severity returns `422`.
- Authorization, ownership, state, and validation failures create no danger-zone or audit record.
  Persistence or audit failure aborts the transaction and rolls the danger-zone insert back.
- Notification recipients and delivery are outside this task because no authoritative notification
  contract exists.

### Backend data and API mapping

- The package-ready shelter source remains
  `GET /api/trekking-routes/:routeId/checkpoints`; creation remains
  `POST /api/trekking-routes/:routeId/checkpoints` with `type=emergency_shelter`.
- The minimum danger-zone contract is a nested collection exposed through
  `GET /api/trekking-routes/:routeId/hazard-areas` and created through
  `POST /api/trekking-routes/:routeId/hazard-areas`. PATCH and DELETE are not part of CTMS-89.
- Danger-zone responses expose `id`, `routeId`, `geometry`, nullable `radiusMeters`, `description`,
  `severity`, `createdAt`, and `updatedAt`. Mutation requests must not accept owner IDs, Host IDs,
  body `routeId`, status, or server-generated fields.

### Offline-package dependency

- CTMS-89 owns authoritative `checkpoints` and `route_danger_zones` read data only.
- Offline package generation, manifests, checksums, downloads, Mobile caching, synchronization, and
  package versioning belong to the Offline Package feature. CTMS-89 does not create those systems.
- The downstream package must consume Route, checkpoint, and danger-zone source data once that
  feature exists; no CTMS-89 test may claim package generation is complete.

### Test evidence

- Existing DTO, service, repository, and real PostgreSQL/PostGIS tests cover checkpoint Point
  validation, Route proximity, server-derived Route position, Host ownership, draft-only creation,
  atomic audit insertion, rollback, and authoritative ordered reads.
- CTMS-89 adds explicit real-PostGIS evidence that an `emergency_shelter` persists its unchanged
  SRID-4326 Point and trimmed safety `instructions`, and is returned by the authoritative checkpoint
  read contract.
- Danger-zone DTO, repository, and service tests cover the exact Point/Polygon radius contract,
  coordinate and description limits, severity enum, draft-only mutation, ownership, transaction,
  and audit behavior. Real PostgreSQL/PostGIS tests cover the physical schema, SRID and geometry
  round trips, Host authorization, failures without side effects, and audit rollback.

## UI and Tests

Jira `CTMS-90` implements `CTMS-23-T02` by extending the owning-Host Route safety editor without
creating a separate shelter model. Emergency shelters continue through the checkpoint contract with
`type=emergency_shelter` and safety `instructions`; the Route map distinguishes their markers.

The same Route map provides explicit checkpoint, Point-hazard, and Polygon-hazard modes. Persisted
Point radii and Polygon boundaries remain visible in read-only Route states, while only draft Routes
enable creation. Client validation mirrors the T01 geometry, radius, severity, and description
contract; backend authorization, ownership, Route state, and PostGIS validation remain authoritative.

Web unit/component evidence covers typed service boundaries, Point/Polygon schemas, stale reads,
duplicate mutation prevention, structured `401`/`403`/`404`/`409`/`422` handling, draft preservation,
map interaction and fallback rendering, shelter markers, and loading/error/empty/success states.
Focused Playwright evidence covers shelter, Point and Polygon persistence, local non-mutation,
read-only state, unauthorized/non-owner rejection, and structured PostGIS `422` draft preservation.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-23`
- Epic: `EPIC 3. Trekking Route and Checkpoint Management`
- Sprint: `Sprint 2`
- Commitment: `Committed`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

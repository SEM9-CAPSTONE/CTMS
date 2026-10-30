# CTMS-010 Create and Edit Trekking Route with Safety Analysis

## 1 Overview

Epic: Trekking Route and Checkpoint Management. Actor: authenticated Host. Priority: Must Have.

Host creates an internal DRAFT Trekking Route by drawing a WGS84 LineString, entering metadata and reviewing automatically retrieved safety information. When editing an owned DRAFT route, unsaved geometry is analyzed without saving it first. Safety remains decision support and does not create a new approval or route-publication flow.

This revision implements the supplied `CTMS_Route_Safety_Spec_v2.docx`. Business-rule changes are recorded in [Route Safety v2 rules](../../docs/business-rules/route-safety-v2.md); the technical contract is in [Route Safety v2](../../docs/features/route-safety-v2.md).

## 2 Scope

In scope:

- Host create/update workflow, metadata validation and route ownership. Saving, submitting and approving a Route do not require or generate start/finish checkpoints or waypoints.
- Automatic safety preview after route geometry changes.
- Unified external, Host-defined and authorized Trip-incident features.
- PostGIS proximity/intersection/distance and independent lifecycle evaluation.
- Source, severity, observed/issued/fetched/validity times, verification and position accuracy in the UI.
- Controlled Admin import from explicitly approved sources with stable identity and quarantine.

Out of scope:

- Trip start/finish selection and waypoint planning. These belong to Create Trip and will be refactored separately.
- Altering the reporter role or authoritative state of CTMS-049 incidents.
- Replacing Host danger-zone management or its DRAFT/audit rules.
- Automatically changing route geometry/status, blocking save or registration, or certifying a route safe.
- Public Camper route browsing, independent scientific forecasts or automatic rerouting.
- Unapproved source scraping or bypassing provider authentication.
- Claiming water availability or potability from base geography.

## 3 Actors and authorization

The backend enforces Host role for analysis. A saved `routeId` must exist and belong to the Host; supplied geometry can represent unsaved edits. Without `routeId`, preview is supported, but cannot expose another Host's route zones or incidents. Trip incidents are read only through Trips owned by the requesting Host and, for saved routes, matching that route. Camper receives no new permissions.

Admin alone may call controlled import. A source must appear in `ROUTE_SAFETY_APPROVED_SOURCES` and each import supplies a permission reference. This is a deployment gate, not evidence that a readable endpoint automatically permits reuse.

## 4 Preconditions and dependencies

Existing authenticated active account, route authorization and PostGIS database are required. MapLibre remains the renderer. After a valid geometry change is debounced, analysis collects current NCHMF warnings, VNDMS hazard events and mapped OSM water resources. Panning alone does not trigger collection. External sources may initially be empty; this must not stop route creation.

## 5 Business rules

| Rule | Contract |
| --- | --- |
| BR-027 clarified | Host ownership; name, optional description, non-zero LineString(4326), computed positive length, difficulty, positive manually entered duration, DRAFT status and timestamps. Endpoints derive from line coordinates. |
| BR-172 and BR-202 retained | Backend access authority; Route remains internal even when active. |
| BR-174 and BR-188 retained | Validate all input and use explicit timezone timestamps. |
| BR-191 and BR-212 retained | Preserve audits and update contract, tests and data documentation together. |
| BR-472 | Role and saved-route ownership for analysis. |
| BR-473 | Separate observation, issue, fetch and validity times; history never becomes current by refetching. |
| BR-474 | Canonical provenance, geometry role, verification and independent position accuracy. |
| BR-475 | Longitude/latitude GeoJSON; valid route; geography-meter proximity; segment/area intersection. |
| BR-476 | Non-blocking decision support, UNKNOWN for no evidence, explicit partial coverage. |
| BR-477 | Preserve Host danger-zone ownership, DRAFT restriction and audits. |
| BR-478 | Approved Admin import, idempotent identity, no old overwrite, invalid quarantine. |
| BR-479 | Read authoritative incidents within existing Trip authorization; do not fabricate positions. |
| BR-480 | Debounce, bounded response, cache isolation, no stale response on changed geometry, stable map source. |
| BR-481 | Resource presence does not imply availability or drinking safety. |

## 6 Route and safety lifecycle

Route: no route → valid authorized creation → DRAFT. Ownership and lifecycle rules for editing, submitting, approving, closing and reopening remain enforced. Checkpoint presence/order is not a Route approval requirement. Analysis is read-only and cannot transition Route status.

Safety: explicit provider validity is authoritative; expiry at the deadline is EXPIRED and future validity is SCHEDULED. BASE_HISTORICAL stays HISTORICAL. For records without provider expiry, use the configured maximum age from issued/observed time; unknown time yields UNKNOWN, old time yields STALE. `fetchedAt` is not the freshness anchor. Existing resolved/closed incident state is preserved in the view. Host-defined zones are active configured route context, without inventing an observation verification.

## 7 Main flow

1. Host opens Create or Edit Route and enters route metadata.
2. Host draws or changes the reusable route line; its distance is displayed. Drawing vertices are geometry controls, not Trip waypoints.
3. After 500 ms without geometry change, the UI requests analysis for the exact geometry.
4. Backend validates Host context, saved-route ownership and geometry.
5. PostGIS finds relevant live and stored features within the configured proximity of the complete route.
6. Analysis merges external records, selected route's Host zones and authorized Trip incidents, then computes lifecycle.
7. Backend returns canonical GeoJSON and a summary. Only ACTIVE non-resource evidence contributes to the risk maximum.
8. MapLibre updates a stable source with `setData`; Host can expand details to review source, time, lifecycle, verification and distance.
9. Further drawing hides the previous geometry's result until a matching analysis arrives.
10. Host may adjust the route, then uses the existing save/update workflow. Analysis error or missing data cannot block saving.

## 8 Data and invariants

Route is geography LineString with SRID 4326. Safety geometries support Point, LineString, Polygon and MultiPolygon. The current Host-zone write contract remains Point/Polygon. Canonical coordinate order is `[longitude, latitude]`.

External data is stored separately in `external_safety_features`; the unique key is `(source, external_id)`. Invalid imports are retained in `safety_import_rejections`. Existing `route_danger_zones` and `trip_incidents` are queried without duplication or lifecycle mutation. Timestamps are timestamptz and API output includes UTC offset. A historical event, an administrative warning area and a physical incident footprint must remain distinguishable.

## 9 API contract

- Existing `POST /api/trekking-routes` and DRAFT update contract remain unchanged.
- `POST /api/route-safety/analyze`: `{ routeId?, geometry }`.
- Response: `riskLevel`, `summary`, `features` FeatureCollection, `analyzedAt`, `dataVersion`, `proximityMeters`, `truncated`, `coverage: PARTIAL`.
- `POST /api/route-safety/import`: Admin-only controlled import of up to 1000 canonical records with source and permission reference. Returns accepted/rejected/unchanged counts.
- Analysis returns at most 500 features and flags truncation. Summary/risk describe returned evidence, never complete coverage of every risk on the route.
- Provider-specific raw payload, credentials and internal import errors are not part of the frontend contract.

Defaults are 300 m Point proximity, 360-minute current-data fallback age and 1440-minute field-incident fallback age, configurable on the backend. These are product parameters and are not scientific safety standards. UI refresh is 60 seconds; this is not a promise that the source updates every minute.

## 10 Error and edge cases

| Case | Behavior |
| --- | --- |
| No authentication or wrong role | 401 or 403; no analysis data exposed. |
| Saved route missing or owned by another Host | 404 or 403 before spatial queries. |
| Non-LineString, out-of-range coordinates, zero-length route or more than 10000 positions | 422; no write. |
| Empty safety store or far-away route | Empty FeatureCollection and UNKNOWN; no absolute safe message. |
| Expired, stale or historical feature | May remain labeled context; excluded from active warning/risk calculation. |
| Provider unavailable | Stored data keeps its original time; fetching or rendering cannot renew it. |
| Invalid import geometry/time or duplicate identity | Quarantine invalid records; upsert valid identities; preserve valid newer observations. |
| Incident location absent | Omit it from spatial results; do not infer a position from Trip/route. |
| Host changes route during request | Abort or discard prior geometry result; no stale map overlay. |
| Safety request fails | Explain failure; preserve route form and allow save. |
| Route intersects an NCHMF commune | Label administrative warning area, not a confirmed physical landslide footprint. |

## 11 Acceptance and test matrix

| Scenario | Expected | Test |
| --- | --- | --- |
| Authorized creation/edit | Existing DRAFT route and form behavior remain correct | Existing route unit/UI suites |
| Own versus other Host route | Only owned saved route analyzes | Service and HTTP integration |
| Cross active Polygon/MultiPolygon or LineString | Relevant feature returned with intersection metadata | Real PostGIS and browser overlay tests |
| Point near middle of line versus far point | Meter threshold applies to full route | Real PostGIS |
| Current versus expired/historical/resource record | Only appropriate active evidence affects risk | Lifecycle/service/PostGIS tests |
| Host zone and authorized Trip incident | Unified features without duplicating source records | Real PostGIS |
| Repeated controlled import and malformed records | Stable identity, independent quarantine | Real PostGIS/import unit tests |
| Debounced geometry change with late response | Correct line's result only | Hook/browser tests |
| Provider or analysis failure | No fabricated current data and no save block | Unit/UI/browser tests |

## 12 Delivery and deployment

The Host preview collects NCHMF administrative warning areas, VNDMS event points and OSM mapped water resources during analysis. Each source reports availability independently. Controlled import remains available for additional historical/resource context. See docs/features/route-safety-v2.md for public endpoints, geometry semantics, limits and source timestamp rules.

For reproducible configuration, schema, API examples and operational limits, see `docs/features/route-safety-v2.md`. Related CTMS-014 and CTMS-049 contracts remain authoritative for their write flows. This revision supersedes the prior CTMS-010 exclusion of hazard analysis; it does not absorb their management stories.

## Scope completion amendment — 2026-10-30

Host route creation must show three independent groups: dangerous areas, nearby hazard points, and nearby mapped water. Sources are NCHMF, VNDMS and OpenStreetMap respectively. Results retain real source geometries and source times, include distance to the full route, and refresh after geometry changes. Water data is unverified map context; ended VNDMS events are labeled as ended/history. A failed source must be visible independently of successful sources. The same behavior applies to unsaved edits; ownership checks precede all provider calls.

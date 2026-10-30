# Route Safety Analysis v2

For a consolidated Vietnamese explanation of the current flow, provider calls, spatial filtering, storage, configuration and map behavior, see [Cách vận hành cảnh báo và nguồn nước quanh tuyến](route-safety-operation.vi.md). The dated sections below also retain implementation history.

Current map refinement (2026-10-31): the Host browser reuses its native map when selecting another route. Drawing and preview share bounded map lifecycle management, preserve overlays when switching to SVG after WebGL failure, and ignore individual tile errors. The satellite/orange-route presentation uses zoom and a text fit-route button. The attribution/info control is removed at the user's request. The list stretches to the detail column with pagination at its bottom. Trip notification callbacks no longer recreate sockets on rerender or open a connection during StrictMode's discarded mount.

Implemented against the supplied `CTMS_Route_Safety_Spec_v2.docx` on 2026-10-29. The route creation/editing UI remains the entry point. Safety is an independent read boundary and cannot change route status or incident reporting permissions.

Updated 2026-10-30 at the user's request: current warnings are collected from NCHMF during analysis rather than relying on imported database contents.

## Data flow

Host geometry → authenticated/validated analysis → parallel NCHMF warning feed + administrative boundary WFS, VNDMS event search and OSM nearby water collection → PostGIS proximity to the full route → merge stored historical/resource context, owned route zones and Host-scoped Trip incidents → canonical FeatureCollection and live-source status → stable MapLibre source and expandable details.

`RouteGeometryEditor` requests analysis after 500 ms without geometry changes. Changes clear the prior overlay until a matching result arrives. Query keys include Host identity, saved route identity and exact geometry. The browser requests NCHMF, VNDMS and OSM independently through CTMS, so each completed layer can render without waiting for slower providers. Concurrent requests may share an in-flight warning fetch; completed warning responses are not cached or reused. Returning to a previously drawn geometry or reopening the form triggers a new check. During refresh each provider overlay is hidden until its own current response arrives; results from the other completed providers remain visible. Route saving does not depend on source availability. The UI refreshes every 60 seconds and distinguishes the source data time, validity, collection status and analysis time.

## Live NCHMF adapter

- Public map source: `https://luquetsatlo.nchmf.gov.vn`; warning request: `POST /LayerMapBox/getDSCanhbaoSLLQ`, form fields `date=yyyy-MM-dd HH:mm:ss` in Vietnam time and `sogiodubao=6`.
- Query the current hour, then at most the previous two hours if the source returns an empty array (publication delay). An empty array does not prove the route has no current hazards.
- `thoigian` is the forecast reference time, `ngay_capnhat` is the source update/issue time, and the forecast horizon is six hours. Fetch time never renews validity. Missing/invalid, expired or future snapshots are rejected.
- Administrative geometry comes from the map's WFS at `https://geosllq.vndss.com/geoserversllq/ows`, layer `cwrs_sllq:bgmap_commune`, requested as GeoJSON in `CRS:84` (longitude/latitude), bounded to the route envelope padded by the configured proximity distance. Join on the old commune `gid`/`commune_id`; repeated mappings to new communes are deduplicated without lowering severity. These polygons represent administrative warning areas, not confirmed landslide footprints.
- Each commune may yield separate landslide and flash-flood features. PostGIS tests proximity against the complete supplied route, not just its endpoints or a commune centroid.
- One collection has a default 12-second deadline; each response is bounded to 16 MiB, warning lists to 20000 rows and boundaries to 1000 features. Incomplete boundary responses are marked `PARTIAL`; analysis results remain limited to 500 features.
- Source status is `LIVE`, `EMPTY`, `PARTIAL`, `UNAVAILABLE` or `DISABLED`, with `checkedAt`, `dataTime` and `validUntil`. A live source failure returns no external current warnings; previously imported `OFFICIAL_CURRENT` records are excluded even if still present in the database. Historical/resources and authorized CTMS context remain available.
- This public map integration currently needs no API key. Provider URLs are server-side environment settings; the browser never receives provider credentials. The endpoints are map implementation interfaces and can change; collection failures are explicit rather than presented as a successful current check.

## API

`POST /api/route-safety/analyze` — Host JWT required. Request:

```json
{"routeId":"optional-owned-route-uuid","geometry":{"type":"LineString","coordinates":[[108,12],[108.01,12]]}}
```

The optional route ID permits unsaved edits to an owned route. Without an ID, only external data and incidents on the Host's own Trips can participate. With an ID, Host zones and Trip incidents are also scoped to that selected route. Responses include `sources` (one status per provider), the backward-compatible NCHMF `liveSource`, `riskLevel`, summary counts, `features` as GeoJSON, `analyzedAt`, `dataVersion`, `proximityMeters`, `truncated` and `coverage: PARTIAL`. HTTP 201 follows the existing POST convention; 401/403/404/422 distinguish authentication, authorization, missing route and invalid geometry. Authorization and geometry validation precede provider calls.

`riskLevel` is the highest severity among returned ACTIVE non-resource records. It is not a scientific probability or a whole-route safety certificate. No active evidence yields UNKNOWN. STALE, EXPIRED, HISTORICAL, SCHEDULED, UNKNOWN and RESOLVED context may remain visible with their lifecycle label, but does not contribute to active warning counts. When the 500-feature limit is reached the result is explicitly incomplete.

`POST /api/route-safety/import` — Admin JWT and approved source required. Request:

```json
{
  "source":"APPROVED_FILE",
  "permissionReference":"Data agreement or approved file reference",
  "features":[{
    "externalId":"warning-001",
    "sourceType":"OFFICIAL_CURRENT",
    "sourceReference":"https://provider.example/warning-001",
    "hazardType":"landslide",
    "severity":"HIGH",
    "geometry":{"type":"Point","coordinates":[108,12]},
    "geometryRole":"source_event_marker",
    "description":"Provider warning",
    "observedAt":null,
    "issuedAt":"2026-10-29T12:00:00+07:00",
    "validFrom":"2026-10-29T12:00:00+07:00",
    "validUntil":"2026-10-29T18:00:00+07:00",
    "lifecycleStatus":"ACTIVE",
    "verificationStatus":"SOURCE_PROVIDED",
    "accuracyMeters":null
  }]
}
```

Maximum 1000 records. The response is `{accepted,rejected,unchanged}`. Raw records are retained server-side; invalid records are quarantined, while valid records upsert transactionally with audit entries. An older provider issue/observation cannot replace a newer version. Import does not copy external hazards into `route_danger_zones` or `trip_incidents`.

## Schema and configuration

Migration `1793270000000-CreateExternalSafetyFeatures` creates `external_safety_features` and `safety_import_rejections`. The feature table enforces unique source identity, accepted geometry types, nonempty valid geometries, severity/source/verification values and increasing validity windows. It stores geography SRID 4326 with a GiST index and timestamps as timestamptz. Queries use Point DWithin or area/segment Intersects and return the distance to the full route.

Environment variables:

| Name | Default | Meaning |
| --- | --- | --- |
| ROUTE_SAFETY_APPROVED_SOURCES | Empty | Comma-separated canonical source names approved for import |
| ROUTE_SAFETY_PROXIMITY_METERS | 300 | Point relevance threshold, 1 to 5000 m |
| ROUTE_SAFETY_CURRENT_AGE_MINUTES | 360 | Fallback when a current record has no provider expiry |
| ROUTE_SAFETY_INCIDENT_AGE_MINUTES | 1440 | Fallback for field incident observation age |
| ROUTE_SAFETY_LIVE_ENABLED | true | Collect current warnings before analysis; false reports DISABLED |
| ROUTE_SAFETY_LIVE_TIMEOUT_MS | 12000 | Total live collection deadline, 1000–30000 ms |
| ROUTE_SAFETY_NCHMF_BASE_URL | https://luquetsatlo.nchmf.gov.vn | HTTPS warning source |
| ROUTE_SAFETY_NCHMF_BOUNDARIES_URL | https://geosllq.vndss.com/geoserversllq/ows | HTTPS administrative-boundary WFS |

## Source semantics and limits

NCHMF commune boundaries must be identified as administrative warning areas, not the exact landslide footprint. VNDMS historical events must retain historical classification even if imported today. Importers supply source classification and geometry role explicitly; a server-side review is required before enabling each source. `fetchedAt` is server receipt time and never establishes event freshness. Source quality, verification and GPS accuracy remain independent.

The 2026-10-30 implementation enables on-demand public NCHMF collection. Controlled import remains available for historical/resource context and existing administrative workflows; it is not the source of current warnings during analysis. VNDMS events and mapped OSM water resources are also collected during analysis. No AI prediction, auto-rerouting, automatic registration block, new incident reporter role or water potability claim is introduced.

## Verification

- Unit: freshness deadlines, old observations fetched today, unknown/future times, invalid CRS/time windows, ownership, non-zero route, source merge and risk exclusion.
- Live adapter: current Vietnam hour, publication delay, deduplication, currentness, HTTP/schema/size failures, incomplete boundaries, no completed-response cache and no fallback to imported current warnings. A direct smoke check against the live source is separate from deterministic fixture tests.
- PostGIS/HTTP: Polygon/MultiPolygon/segment crossing, near/far points, expired context, concurrent repeated imports, rejection of older updates, invalid quarantine, role/ownership and Host-zone merge. Use an isolated database ending `_test`.
- UI: debounce/race handling, source reuse with `setData`, metadata and non-blocking analysis failures; create/edit route regressions.
- Business-rule source: `docs/business-rules/route-safety-v2.md`, BR-472 through BR-481 and clarified BR-027.

Run backend tests from `services/api` and frontend tests from `apps/web`:

```powershell
# API unit regressions
node node_modules/jest/bin/jest.js --runInBand --testPathPattern='route-safety|trekking-routes|incidents'
# API integration: set TEST_DATABASE_URL to a disposable PostGIS database ending _test first.
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --testPathPattern=route-safety.integration-spec
# Web unit regressions
node node_modules/vitest/vitest.mjs run src/features/route-safety src/features/trekking-routes
# Browser checks; all API and map-provider requests use fixtures.
node node_modules/@playwright/test/cli.js test --config playwright.route-safety.config.ts
```

Browser tests use installed Playwright Chromium by default. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome executable if needed. Apply both new API migrations to the application database through the existing migration workflow before using the feature. Verification uses an isolated test database and does not apply migrations to the application database.

## Three-layer route preview (2026-10-30)

The Host create/edit form automatically displays dangerous areas, hazard event points and nearby water in three groups. Water is blue on the map; hazard styling follows severity and lifecycle. Distances are measured by PostGIS geography with ST_DWithin against the full route, including nearby water lines/areas and event points that do not intersect the route. Default proximity is 300 m. The UI never treats an unavailable provider as an empty successful search.

### VNDMS

GET /EventDisaster/Searching?year=YYYY&keyword= on https://vndms.gov.vn, for the current Vietnam year and the previous year. The adapter retains lon/lat as a provider representative Point; it never invents affected-area polygons. Offset-free provider timestamps are interpreted as Vietnam local time. da_ketthuc=true produces ended historical context; false preserves an ongoing event subject to freshness evaluation. Missing/invalid positions, times or state are skipped and the provider is PARTIAL. The disaster_level value is retained as provider text; it is not silently mapped to CTMS severity. Search results describe reported events, not guaranteed present-day conditions.

### Water

OpenStreetMap nodes tagged natural=spring, amenity=drinking_water/water_point or man_made=water_well, and ways tagged waterway=stream/river or natural=water. For small envelopes (at most 0.01 square degrees), the OSM map JSON reader starts first and an Overpass request starts after 400 ms if needed. The first successful reader cancels its peer. Larger envelopes use Overpass only; map way geometry is reconstructed from actual node references. OSM attribution links to https://www.openstreetmap.org/copyright. Resources remain unverified, have unknown observation time and never contribute to active hazard risk. Relations and invalid geometries are skipped with PARTIAL status; full national coverage is not claimed. The water request is bounded to 1000 records and a route envelope of at most one degree per axis. Source failures return UNAVAILABLE and leave route saving available.

Configuration (also present in services/api/.env for local development):

| Variable | Default |
| --- | --- |
| ROUTE_SAFETY_VNDMS_ENABLED | true |
| ROUTE_SAFETY_VNDMS_BASE_URL | https://vndms.gov.vn |
| ROUTE_SAFETY_WATER_ENABLED | true |
| ROUTE_SAFETY_OVERPASS_URL | https://overpass.private.coffee/api/interpreter |
| ROUTE_SAFETY_OSM_MAP_URL | https://api.openstreetmap.org/api/0.6/map.json |
| ROUTE_SAFETY_CONTEXT_TIMEOUT_MS | 20000 |

Reproducible live provider check (no database writes), from services/api:

```powershell
node -r ts-node/register/transpile-only scripts/check-route-safety-live.ts
```

SMOKE_ROUTE can optionally contain a GeoJSON LineString. Counts from this check are collected provider records before PostGIS filtering; they are not counts of features near the sample route.

### Verification recorded 2026-10-30

- API unit regressions: 21 suites, 275 tests passed (route-safety and trekking-routes).
- Web unit checks: 14 tests passed (route safety and route creation form).
- Chromium: 3 fixture-backed browser scenarios passed, including all three display groups, unavailable sources/retry and non-blocking save progression.
- TypeScript API and web builds/checks passed; scoped Biome checks passed.
- Live provider collection: NCHMF returned 4 real warning polygons/multipolygons for a Quang Ninh sample; VNDMS returned 1215 valid positioned events across 2026/2025 with PARTIAL status for excluded records; OSM map fallback returned 4 mapped water geometries for a Da Lat sample with PARTIAL status for unsupported/invalid elements. These are collection counts before PostGIS filtering.
- PostGIS/HTTP integration test was added for nearby non-intersecting event points and water points/lines. Execution remains unverified in this session: localhost:5432 refused connections and Docker Engine did not become ready within the startup deadline. No application database migrations were applied during verification.

### Runtime repair and PostGIS verification — 2026-10-30

The development API was serving an older dist build without RouteSafetyModule (POST analyze returned 404), while the application database had not applied the two Route Safety migrations. Restored explicit API outDir and declarationDir to dist, rebuilt the API and confirmed both migrations are recorded. Generated JavaScript/declaration files left in src by the previous build configuration were backed up under node_modules/.cache/route-safety-live before cleanup. The live analyze endpoint is now registered and guarded.

All six HTTP/PostGIS integration scenarios passed on the isolated ctms_route_safety_20261030_test database, including nearby event points/water lines and ownership checks. The pre-existing ctms_test database triggered a PostgreSQL system-index error; it was left unchanged and was not used for the successful run.

A read-only analysis of the Da Nang route from the user screenshot ([108.178897,16.062331] to [108.168254,16.056474]) completed against the application database and live providers. It returned 3 nearby water features; provider states were NCHMF LIVE, VNDMS PARTIAL, OSM LIVE. No nearby active hazard evidence was found in the returned data, so risk remained UNKNOWN.

### Progressive preview — 2026-10-30

The Host preview requests NCHMF, VNDMS and OSM independently via the optional analyze request field source. Omit source to retain the existing combined API. The same Host authorization, route ownership, geometry validation and spatial filtering run for every request. Single-source responses contain only that source status; legacy liveSource is included only when NCHMF is requested.

The UI renders each completed result immediately, merges features by stable identity, recomputes risk/counts from the returned evidence and caps the merged display at 500 features. Loading sources remain visibly loading and are not interpreted as empty/safe. Query keys include source, Host, route and exact geometry. Changed/cleared geometry hides previous results; completed snapshots are not substituted while a fresh check is in progress. Refresh/retry is independent per source and slow water collection cannot delay hazard layers.

For small water envelopes, the bounded OSM map reader starts first. If it has not completed after 400 ms, an Overpass request starts in parallel; the first successful reader cancels its peer. Larger envelopes use Overpass only. The source deadline remains bounded. No fabricated data or cached old warning is used to claim an instant response.

Measured live on the screenshot route before the water-reader race: VNDMS analysis completed in 305 ms, NCHMF in 667 ms, OSM in 9406 ms. These are one-run observations, not latency guarantees. The progressive UI can render the first two results without waiting for the third. Automated coverage includes a held water response while hazard details remain visible and appear on the map.

### Route scope clarified — 2026-10-30

Route creation and editing manage reusable LineString geometry and basic route metadata, with live nearby hazard points/areas and water displayed during drawing and after saving. Saving goes directly to a read-only route/safety preview and route submission; the waypoint/location editing step has been removed from the Host route flow. Drawing vertices have neutral numbered labels, without assigning Trip start/end roles.

Route create/update/submit never generates checkpoints. Route submission and Admin approval validate route geometry/metadata, ownership and lifecycle without requiring checkpoint counts/order. Editing an unused draft no longer moves legacy checkpoints or depends on their proximity/arrival offsets. Existing checkpoint data/contracts are retained for compatibility; no records are deleted or migrated. Trip start/end and waypoint planning are deferred to a separate Create Trip refactor.

### Map symbols and source water — 2026-10-30

The drawing and saved-route maps use a bottom-right legend instead of the expanded source/feature panel. Hazard points are triangle symbols, water sources are blue drops, and hazard areas use the same severity palette as the legend. Point selection opens a short source/time popup; area/line hover reveals details. Source availability remains visible as compact status dots, with original timestamps in tooltips, and refresh remains inside the map. These controls do not add drawing vertices. SVG fallback keeps spatial overlays and point details when the base map is unavailable.

Water collection now selects springs, mapped drinking-water/water points, wells and river/stream lines. It no longer requests natural=water polygons. OSM map parsing, API spatial filtering before the result limit, and frontend merging/rendering exclude surface-water areas, including older stored/imported/cached results. Water remains unverified for current availability and potability; the map keeps compact OSM attribution.

Legend refinement — 2026-10-31: provider names, provider health/timestamps, data-status lines and the footer are omitted from the legend. It contains only symbol/color keys and refresh, with request errors in the refresh tooltip. Attribution is supplied through the standard compact map information control rather than a legend footer. Provider metadata remains in the API and feature popups.


### Host route browser — 2026-10-31

The Host route list uses a responsive two-column layout: selectable cards with five routes per page on the left, and the selected route metadata, map and five nearby hazard/water summary tiles on the right. The heading and filters stay pinned while scrolling. There is no tab bar or route waypoint section. Creating and editing routes keep their existing navigation and lifecycle restrictions. The route map retains the symbol legend, refresh, zoom and fit-route controls. The Dashboard Trip map omits its fit-route button, and Dashboard toolbars omit the create-route shortcut; route creation remains available from route management. Counts and map overlays share one progressive analysis result; missing provider results are shown as a dash rather than zero.

GET /api/trekking-routes/paginated accepts optional search (trimmed, at most 150 characters) and sort (newest, oldest, name). Search is a literal case-insensitive name substring. Filtering, sorting and pagination apply within the authenticated Host scope before paging. The response adds statusCounts across the Host search results, independent of the selected status. Existing default page sizes and callers are unchanged. Changing search/status/sort resets the browser to page one; stale page responses cannot overwrite the selected query.

Validation: 232 API unit tests and 21 focused web unit tests passed. Seven HTTP/PostGIS integration scenarios passed on the isolated route-safety test database, including pagination, all status counts, search/sort and foreign-Host isolation. Chromium covered desktop layout, six-item numbered pagination, full-list search/status/sort and narrow-screen overflow using deterministic fixtures.

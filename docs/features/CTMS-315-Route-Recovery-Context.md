# CTMS-315 — View Direction and Distance Back to Route: Preparation + Logic

Story: Jira CTMS-247 / specification CTMS-062. UI and on-device recovery calculations belong to CTMS-316.

## Scope

Provide a read-only, participant-authorized context for an exact locally selected package. The server does **not** know which package is active on a device. No activation, download, package publication, Route/Trip mutation, GPS recording, OFF_ROUTE/ON_ROUTE transition or navigation UI is performed by this endpoint.

The existing route-deviation endpoint and its MD5 route version remain unchanged. Recovery does not compute a second authoritative route: it reads `route.geojson` from the existing immutable package using the same private storage reader, archive verifier and canonical geometry validator already used by package/Route code. The current database Route is used only to compare identity/fingerprint. It is never returned as a substitute for package geometry.

## Request and authorization

```http
GET /api/trips/{tripId}/route-recovery/context?packageId={uuid}&packageVersion={positiveInteger}
Authorization: Bearer <access-token>
```

- Both query fields are mandatory. `packageVersion` is an integer in `[1,2147483647]`; no latest-version default is accepted. Unknown query fields are rejected.
- Valid UUID inputs are normalized to lowercase before identity comparison.
- Existing JWT and role guards accept Camper/Porter, with no Host/Admin bypass.
- Reuse the package-download participation predicate: an actual registered/joined member of a confirmed booking who has not left, or a currently assigned Porter. Booking ownership alone is insufficient.
- Missing Trip, unrelated user and withdrawn participation all return the same `404 {code: "TRIP_NOT_ACCESSIBLE", message: "Trip not found"}` body. Wrong role is 403; missing/invalid authentication is 401.
- Malformed Trip UUID, missing query or invalid package identity/version is 422, following the application's validation convention.
- After participation authorization, an authorized non-navigable Trip (including completed/cancelled/draft) returns 200 UNAVAILABLE/TRIP_NOT_NAVIGABLE with no geometry. Published supports preparation; ongoing supports the requested immutable package. AVAILABLE is not confirmation that GPS recording or Trip departure is authorized.
- Responses use `Cache-Control: private, no-store`. Storage paths, private provenance and other Trips' package metadata are never returned.

## Response contract

```json
{
  "status": "AVAILABLE",
  "reason": null,
  "tripId": "<trip-uuid>",
  "tripStatus": "ongoing",
  "observedAt": "2026-11-11T03:00:00.000Z",
  "requested": {"packageId": "<package-uuid>", "packageVersion": 1},
  "package": {
    "id": "<package-uuid>", "version": 1,
    "sha256": "<whole-archive-sha256>", "generatedAt": "2026-11-10T00:00:00.000Z",
    "routeId": "<route-uuid>", "routeFingerprint": "<sha256-of-canonical-package-geometry>"
  },
  "current": {
    "routeId": "<current-trip-route-uuid>",
    "routeFingerprint": "<sha256-of-canonical-current-geometry>",
    "latestPackageVersion": 1
  },
  "geometry": {"type": "LineString", "coordinates": [[108,16],[108.01,16.01]]},
  "conventions": {
    "coordinateSystem": "EPSG:4326", "coordinateOrder": "longitude,latitude",
    "distanceUnit": "metre", "bearingUnit": "degree",
    "bearingReference": "true-north-clockwise", "bearingRange": "[0,360)"
  }
}
```

The AVAILABLE response above and the following three examples cover all status shapes. Angle-bracket values are illustrative identifiers/digests, not production data.

### STALE example: Route changed, requested geometry retained

```json
{
  "status": "STALE",
  "reason": "ROUTE_VERSION_CHANGED",
  "tripId": "<trip-uuid>",
  "tripStatus": "ongoing",
  "observedAt": "2026-11-11T03:00:00.000Z",
  "requested": {"packageId": "<package-v1-uuid>", "packageVersion": 1},
  "package": {
    "id": "<package-v1-uuid>", "version": 1,
    "sha256": "<verified-v1-archive-sha256>", "generatedAt": "2026-11-10T00:00:00.000Z",
    "routeId": "<route-uuid>", "routeFingerprint": "<old-geometry-sha256>"
  },
  "current": {
    "routeId": "<route-uuid>", "routeFingerprint": "<different-current-geometry-sha256>",
    "latestPackageVersion": 2
  },
  "geometry": {"type": "LineString", "coordinates": [[108,16],[108.01,16.01]]},
  "conventions": {
    "coordinateSystem": "EPSG:4326", "coordinateOrder": "longitude,latitude",
    "distanceUnit": "metre", "bearingUnit": "degree",
    "bearingReference": "true-north-clockwise", "bearingRange": "[0,360)"
  }
}
```

The coordinates are still v1's authenticated positions. For NEWER_PACKAGE_AVAILABLE with an unchanged Route, the old/current fingerprints match, but the requested/latest package versions differ.

### MISMATCH example: UUID does not identify the requested Trip/version

```json
{
  "status": "MISMATCH",
  "reason": "PACKAGE_ID_VERSION_MISMATCH",
  "tripId": "<trip-uuid>",
  "tripStatus": "ongoing",
  "observedAt": "2026-11-11T03:00:00.000Z",
  "requested": {"packageId": "<different-package-uuid>", "packageVersion": 1},
  "package": null,
  "current": {
    "routeId": "<route-uuid>", "routeFingerprint": "<current-geometry-sha256>",
    "latestPackageVersion": 1
  },
  "geometry": null,
  "conventions": {
    "coordinateSystem": "EPSG:4326", "coordinateOrder": "longitude,latitude",
    "distanceUnit": "metre", "bearingUnit": "degree",
    "bearingReference": "true-north-clockwise", "bearingRange": "[0,360)"
  }
}
```

No metadata is looked up by UUID across other Trips. A ROUTE_ID_MISMATCH can include the verified requested package identity, but still has null geometry.

### UNAVAILABLE example: file could not be authenticated or parsed

```json
{
  "status": "UNAVAILABLE",
  "reason": "ARTIFACT_UNAVAILABLE",
  "tripId": "<trip-uuid>",
  "tripStatus": "ongoing",
  "observedAt": "2026-11-11T03:00:00.000Z",
  "requested": {"packageId": "<package-v1-uuid>", "packageVersion": 1},
  "package": null,
  "current": {
    "routeId": "<route-uuid>", "routeFingerprint": "<current-geometry-sha256>",
    "latestPackageVersion": 1
  },
  "geometry": null,
  "conventions": {
    "coordinateSystem": "EPSG:4326", "coordinateOrder": "longitude,latitude",
    "distanceUnit": "metre", "bearingUnit": "degree",
    "bearingReference": "true-north-clockwise", "bearingRange": "[0,360)"
  }
}
```

`package` is null until the exact requested artifact has been verified. `geometry` is null except for AVAILABLE/STALE. Null values are explicit, not omitted. Coordinates are the canonical two-dimensional LineString positions, unchanged in order, including repeated positions. The fingerprint is SHA-256 of the canonical full geometry, **not** the MD5 `routeVersion` used by the older route-deviation API. Package version ordering is per Trip; fingerprints are equality identifiers, not ordered version numbers.

| Status | Reason | Geometry |
| --- | --- | --- |
| AVAILABLE | null | Exact requested verified package Route; current identity/fingerprint matches and no newer package exists at the snapshot |
| STALE | ROUTE_VERSION_CHANGED | Exact requested verified old geometry, with both old/current fingerprints; never current replacement geometry |
| STALE | NEWER_PACKAGE_AVAILABLE | Exact requested verified geometry, with requested/latest package versions |
| MISMATCH | PACKAGE_ID_VERSION_MISMATCH | null; requested Trip/version resolves to a different package UUID |
| MISMATCH | ROUTE_ID_MISMATCH | null; verified package Route identity differs from the Trip Route |
| UNAVAILABLE | PACKAGE_NOT_FOUND | null; no package exists for the requested Trip/version; no fallback to latest or lookup across Trips |
| UNAVAILABLE | ARTIFACT_UNAVAILABLE | null; private artifact missing/corrupt, unsupported archive/schema, malformed JSON/geometry or conflicting manifest/payload identity |
| UNAVAILABLE | ROUTE_UNAVAILABLE | null; current Route/geometry unavailable for comparison |
| UNAVAILABLE | TRIP_NOT_NAVIGABLE | null; participation exists, but Trip is neither published nor ongoing |

When both Route and package versions changed, ROUTE_VERSION_CHANGED takes precedence; `current.latestPackageVersion` still reports the newer version. Mismatch/unavailable takes precedence over freshness. STALE means version/context divergence, not byte corruption and not a GPS sample age assessment. This endpoint does not assess weather/knowledge source freshness; CTMS-057/119 owns that behavior.

## Snapshot and integrity

1. Start a TypeORM REPEATABLE READ transaction and set it READ ONLY. No write locks, activation or updates are issued.
2. Evaluate participation within that snapshot. Read Trip Route geometry, latest package version and observation time, then exact Trip/version metadata through the same EntityManager.
3. Pass this metadata object directly to the shared package service; do not requery metadata through another connection. Private content-addressed storage verifies the whole archive length/SHA-256. The existing bounded archive verifier validates manifest and payload sizes/hashes before the route parser runs. Validate manifest Trip/version/schema, payload Route ID/fingerprint and canonical finite/in-range LineString coordinates.
4. Compute freshness against the current Route **in the same DB snapshot**. Verify and return only the selected package's geometry. A concurrent publication/Route change appears on the next request, never as a mixture of observations.
5. End the read-only transaction and recheck participation on a fresh connection to reject revocations committed during file verification.

`observedAt` is the DB transaction timestamp. It describes an observation, not a lease guaranteeing future access/freshness. The fresh authorization check is deliberately separate from the snapshot; it does not replace snapshot Route/version information. Immutable content-addressed file reads are validated against snapshot hashes; a missing or modified file fails closed. Database/infrastructure/programming failures outside the known artifact verification failure remain server errors rather than being silently mislabeled.

Existing `offline_packages` already stores UUID, per-Trip version, schema, manifest, SHA-256, size, private artifact key and generation time. No migration or new activation record is needed.

## CTMS-316 integration

- Identify the actual local active package from the existing verified, account-scoped package store. Pass its exact UUID/version for online checks. Do not treat this endpoint as evidence that the server selected/activated that package.
- Derive nearest return point, distance and direction locally from the verified downloaded Route, using current valid GPS. No connectivity is required for the calculation itself.
- Coordinates are `[longitude, latitude]` in WGS84 degrees. Preserve segment order; distances are horizontal metres. Bearing is clockwise from true north: 0 north, 90 east, 180 south, 270 west, normalized to `[0,360)`. This is an absolute bearing, not a device-relative compass arrow. No north/heading sensor is supplied by 315.
- Handle zero-distance/degenerate segments without inventing a movement direction. Represent absent, stale, future-dated or inaccurate GPS explicitly using applicable existing GPS rules. 315 does not assign a fabricated GPS quality or invent a new sample-age threshold.
- Show online context staleness distinctly from invalid bytes or unavailable GPS. Pre-start updates follow the existing package update rules. Ongoing Trips keep their locally active locked package; STALE does not authorize a hot swap.
- Cache only correctly scoped context with observation time and package identity. A network outage is not a fresh confirmation. Do not turn 401/403/404, invalid packages or identity mismatch into an unrestricted offline fallback.
- A straight-line return direction is not terrain-aware walking directions or a promise of a safe traversable path. It must not claim turn-by-turn navigation, obstacle avoidance or a route-state transition.

## Validation and handoff

Test sources cover the geometry parser, status precedence, exact identity, JWT/roles/participation, input validation, published/ongoing/completed/cancelled/draft status, missing/corrupt/unparseable artifact, unchanged Trip row, version lock, concurrent Route/publication changes and revocation during file verification. Integration uses a separate `*_test` database and a generated schema with schema-qualified cleanup; no development seed/reset is used.

The Jira link currently says CTMS-315 "is blocked by" CTMS-316. The implementation contract is needed by 316, so this appears reversed; the owner should review the link. No Jira relationship or status was changed automatically. No UI implementation or field navigation validation is claimed by this task.

### Shared-code diff review

- `package-route.reader.ts` is a new file relative to `origin/develop`, not an existing download reader replacement. It uses the existing canonical LineString validator and is called only after archive verification.
- `downloadableTripStatus(tripId, userId)` retains its public signature, return type, one-query execution and allowed published/ongoing results. Its participation predicate is unchanged. The Trip-status restriction moves from SQL into the existing method's result filtering so a new snapshot-aware helper can report an authorized completed Trip as unavailable. Confirmed booking, member status, `left_at` and Porter-assignment conditions are unchanged.
- `readArtifact(tripId, version)` retains its signature and return type. It still queries exact metadata once, returns null if absent, then reads private storage with size/SHA-256 and verifies the archive. That final sequence is extracted unchanged into a private helper shared with the new snapshot route reader; this is a refactor of an existing method, not solely an added method.
- The existing download controller/service and route-deviation endpoint are not modified. Module changes register the additional controller/service/repository.
- No entity, migration or TypeORM configuration changes exist. `dataSourceOptions.synchronize` remains false. The integration test compares the complete Trip row (including status and `updated_at`) before/after the endpoint and checks PostgreSQL's actual read-only isolation settings.
- No files are staged. The prior task's untracked PR draft, spike document and artifacts are excluded from the CTMS-315 file set. Artifacts remain ignored and must not be committed.

### Checks run on 2026-11-11

- API unit regression: 193 suites / 2,335 tests passed, including 25 new service/parser tests. The final task-specific service/parser rerun passed 25/25.
- HTTP + real PostgreSQL/private-artifact integration and related package/access regression: 3 suites / 60 tests passed, including 27 new recovery tests. The final isolated recovery rerun passed 27/27. A dedicated `ctms315_test` database is used; only generated test schemas and temporary fixture files are cleaned up.
- Existing authenticated package-download HTTP E2E regression: 1 suite / 38 tests passed.
- Expanded complete package module verification: 8 unit suites / 114 tests, 4 integration suites / 64 tests (including basemap publication), and both package generation/download E2E suites / 39 tests passed. These overlap the earlier results and are not additional disjoint test counts.
- API ESLint, Nest build and TypeScript no-emit check passed. Task-specific Biome and `git diff --check` passed.
- All three root gates passed with exit code 0: `pnpm lint:all`, `pnpm build:all`, `pnpm test:all`. The root test command passed API 193 suites / 2,335 tests, Web 259 files / 1,732 tests, and AI 34 tests. These scripts do not include Flutter or integration/E2E suites.
- Non-failing diagnostics: Web lint reported 12 warnings and no errors; AI reported 3 warnings (one dependency deprecation and two cache-write permission warnings). No unrelated code/configuration was changed to suppress them.
- Full-repository integration/E2E, mobile tests and remote CI were not run. Related package integration/E2E results are listed above. No claim of UI completion or remote CI success is made; remote CI must be verified after a CTMS-315 PR is pushed and before merge.

Commands (from `services/api`; integration requires a separate `TEST_DATABASE_URL` ending in `_test`):

```powershell
node node_modules/jest/bin/jest.js --runInBand
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modules/offline-package-download/route-recovery.service.spec.ts src/modules/offline-packages/package-route.reader.spec.ts
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/route-recovery.integration-spec.ts test/offline-package-access.integration-spec.ts test/offline-packages.integration-spec.ts
node node_modules/jest/bin/jest.js --config test/jest-offline-package-download.json --runInBand
node node_modules/eslint/bin/eslint.js src
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/@nestjs/cli/bin/nest.js build
```

Additional module-wide and root commands:

```powershell
# From services/api, with the same separate *_test database for DB suites:
node node_modules/jest/bin/jest.js --runInBand --testPathPattern='modules/(offline-package-download|offline-packages)/'
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/offline-packages.integration-spec.ts test/offline-package-access.integration-spec.ts test/offline-basemaps.integration-spec.ts test/route-recovery.integration-spec.ts
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/offline-packages.e2e-spec.ts test/offline-package-download.e2e-spec.ts
# From the repository root:
pnpm lint:all
pnpm build:all
pnpm test:all
```

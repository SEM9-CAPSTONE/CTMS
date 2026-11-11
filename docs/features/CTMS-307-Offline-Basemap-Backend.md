# CTMS-307: per-package offline basemap integration

## Scope and ownership

2026-11-10 extension on the CTMS-307 backend branch. CTMS-052 owns core generation,
CTMS-053 download, CTMS-054 integrity, CTMS-058/307/308 map and GPS consumption,
and CTMS-119 safety-driven new versions. This extension adds raster preparation
and private delivery; it does not implement missing authoritative safety approvals.

Correction to the earlier investigation: migration `1794200000000-CreateOfflinePackages`
already installs `offline_package_on_publication`. Publication and its initial job
commit atomically, including publishers outside the Nest service. The absence of
a call to `requestInitial()` does not mean the publication trigger is absent.

## Business flow

1. Publishing a trip atomically enqueues the existing initial core job.
2. The existing core worker validates approved route/checkpoints, safety feeds,
   guidance and coverage policy. Missing authoritative sources remain BLOCKED.
3. Inserting a READY immutable core package atomically enqueues a basemap job.
   The new migration also backfills jobs for existing core packages.
4. A dedicated worker takes the next published trip's eligible package. It verifies
   the ZIP hash, extracts its route, computes route-specific bounds plus an
   approximately 1 km buffer and downloads raw OSM ways. It never downloads
   third-party rendered tiles. It renders PNG Web Mercator tiles into TMS MBTiles.
5. The publisher verifies SQLite, expected tile cells, tile diversity, size, core
   hash and route coverage before binding the content-addressed private file to
   that exact package UUID. A package cannot be rebound to a different file.
   Publication rechecks and locks the trip as published. No detector context or
   recorded checkpoint visits are rewritten by basemap publication.
6. The app downloads core and raster through separately authorized endpoints.
   Complete map readiness requires both artifacts validated locally; core READY
   alone does not mean the basemap is ready. Missing raster permits the existing
   vector fallback without falsely advertising full preparation.

## Worker and recovery

Apply API migrations using the existing deployment procedure. API cwd commands:

```powershell
python -m pip install Pillow
pnpm offline:basemap:once
pnpm offline:basemap:worker
```

The worker is a separately supervised process, not started inside HTTP requests.
Configure `DATABASE_URL`, `OFFLINE_PACKAGE_STORAGE_ROOT`,
`OFFLINE_BASEMAP_STORAGE_ROOT`, `OFFLINE_BASEMAP_WORK_ROOT` and optionally
`OFFLINE_BASEMAP_PYTHON`. Run from `services/api`; the renderer resolves relative
to its script, not to the user's current trip. Deploy the repository Python script
and Node operator scripts alongside the worker; the current API-only Docker image
does not install Python/Pillow or automatically run this dedicated worker.

The API and worker share private artifact storage. No MBTiles binaries are checked
into Git. Working extracts/files are removed after each attempt. Logs identify
package and outcome without exposing credentials or personal GPS.

A PostgreSQL session advisory lock serializes workers without holding a long
transaction during rendering. A killed process releases the lock; a subsequent
worker recovers GENERATING jobs. Attempts are durable and capped at three, with
five-minute backoff. Once the file binding exists, recovery reconciles the job to
READY, including a crash after binding but before updating job status. FAILED jobs
need operator investigation and explicit retry; ordinary page opens do not reset
attempt counters. Non-published trips are not selected for new raster generation.

## API

- `GET /api/trips/:tripId/offline-packages/:version/tiles`
- `GET /api/trips/:tripId/offline-packages/:version/tiles/download`

These use the existing package download authorization, exact package version,
private cache headers and file SHA-256 verification. See controller route spelling
as the source of truth. Missing raster is a not-ready response, never a substitute
placeholder image. Membership is rechecked on each HTTP request; local revocation
cleanup remains a mobile responsibility.

## Limits

Zoom 12–16, 5,000 tile ceiling, 100 MiB artifact ceiling, 64 MiB raw extract ceiling.
Dateline-crossing/polar routes are rejected rather than downloading near-world
data. Large routes fail within these bounds and require a different rendering
deployment; support for every geographic route is not claimed. Overpass outages
consume retries. A regional extract service is preferable for production volume.
Raster rendering remains ways-only: no DEM/contours, multipolygon assembly or
guarantee of complete trail coverage. Attribution is © OpenStreetMap contributors.
Tile hash diversity is a rejection heuristic, not proof of map accuracy.

## Verification

Commands from repository root:

```powershell
node services/api/node_modules/typescript/bin/tsc --project services/api/tsconfig.json --noEmit
node --test services/api/scripts/offline-basemap-policy.test.cjs
python scripts/test_build_osm_raster.py
node services/api/node_modules/jest/bin/jest.js --config services/api/jest.config.js --runInBand --testPathPattern 'offline-packages|offline-basemap.service'
$env:TEST_DATABASE_URL='postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'
node services/api/node_modules/jest/bin/jest.js --config services/api/test/jest-integration.json --runInBand --testPathPattern 'offline-basemaps.integration-spec|offline-packages.integration-spec'
```

Tests cover immutable publication/rollback/backfill, existing core generation,
authorization and file integrity, route-specific bounds, rejected coordinates,
and actual worker failure/retry persistence. They do not constitute a new live
OSM-to-emulator end-to-end recording or real upstream safety adapter validation.

Verified on Windows, 2026-11-10: API typecheck PASS; targeted Jest 55/55;
isolated PostgreSQL integration 18/18 (including actual worker retry exhaustion);
Node route policy 5/5; Python renderer 5/5; Biome on seven TypeScript files PASS;
`git diff --check` PASS. PostgreSQL used the disposable test service on port 55451.
No application database migration, live OSM download or production worker startup
was performed as part of this checkpoint.

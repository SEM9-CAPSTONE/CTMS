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
   the ZIP hash, extracts its route and all checkpoints, computes their combined
   bounds plus a minimum 1,500 m buffer and downloads raw OSM ways. It never downloads
   third-party rendered tiles. It renders PNG Web Mercator tiles into TMS MBTiles.
5. The publisher verifies SQLite, expected tile cells, tile diversity, size, core
   hash, route/checkpoint coverage and the requested buffer before binding the content-addressed private file to
   that exact package UUID. A package cannot be rebound to a different file.
   A verified temporary file is published with an exclusive atomic hard link on the
   same filesystem, so downloads cannot observe a partially copied file.
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
Run from `services/api`; the renderer resolves relative to its script, not to the
user's current trip. The backend image now includes the Node scripts, Python,
Pillow, SQLite support and DejaVu fonts. Compose starts `basemap-worker` as a
separate process using that same image, with `restart: unless-stopped`. Production
and registry overlays inherit the worker and use the same database and image tag
as the API. The production deploy script includes the worker in its wait step.

Apply existing migrations before starting the worker. This extension adds no
schema changes or new job statuses. For a local Docker deployment:

```powershell
docker compose build api basemap-worker
docker compose up -d basemap-worker
docker compose ps basemap-worker
docker compose logs --tail 50 basemap-worker
```

The API and worker must use the same named artifact volumes. The worker mounts
core packages read-only, writes basemaps to the private sidecar volume and renders
in a 256 MiB temporary filesystem. Compose caps it at one CPU and 2 GiB RAM.

| Variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | Same PostgreSQL database as the API; required for worker deployment |
| `OFFLINE_PACKAGE_STORAGE_ROOT` | `.private-offline-packages`; immutable core input |
| `OFFLINE_BASEMAP_STORAGE_ROOT` | `.private-offline-basemaps`; shared private output |
| `OFFLINE_BASEMAP_WORK_ROOT` | `.private-offline-basemap-work`; disposable per-attempt files |
| `OFFLINE_BASEMAP_PYTHON` | `python` locally, `python3` in Compose |
| `OFFLINE_BASEMAP_BUFFER_METERS` | `1500`; may increase up to `5000`, cannot reduce below 1500 |
| `OFFLINE_BASEMAP_OSM_URL` | `https://overpass-api.de/api/interpreter`; raw OSM Overpass endpoint, not a tile URL |
| `OFFLINE_BASEMAP_HEARTBEAT_FILE` | Set by Compose to `/tmp/ctms-basemap-heartbeat` |

Zoom 12–16 and the resource ceilings below are deliberately fixed to match the
existing mobile MBTiles contract. No PMTiles/vector conversion is introduced.

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

The child renderer/publisher run asynchronously so heartbeat updates continue
during rendering. Healthcheck verifies a heartbeat no older than 60 seconds and
database/schema access on a separate connection. A healthy standby worker may
wait for the existing advisory lock; rendering is intentionally serialized, not
a horizontally parallel job queue. Docker restart policy restarts exited
containers; an unhealthy running container requires monitoring/operator action.

| Failure code | Operator action |
| --- | --- |
| `CORE_INTEGRITY_FAILED` | Investigate immutable ZIP/storage; do not bypass verification |
| `ROUTE_INVALID` / `CHECKPOINTS_INVALID` | Correct upstream data and generate a new core version |
| `REGION_TOO_LARGE` / `TILE_LIMIT_EXCEEDED` | Use a separately approved larger-area pipeline; do not silently truncate |
| `REGION_UNSUPPORTED` / `ANTIMERIDIAN_UNSUPPORTED` | Unsupported polar/dateline coverage |
| `BUFFER_INVALID` | Configure 1500–5000 metres consistently for worker and publisher |
| `BASEMAP_GENERATION_FAILED` | Check raw OSM availability, Python/Pillow, private volume capacity and permissions |

Inspect `offline_basemap_jobs.status, attempts, last_error, next_attempt_at`.
After fixing the underlying problem, an operator can explicitly reset only the
affected unbound job, not every job or an existing file binding:

```sql
UPDATE offline_basemap_jobs j
SET status='PENDING', attempts=0, last_error=NULL, next_attempt_at=now(), updated_at=now()
WHERE j.package_id = '<reviewed-package-uuid>'::uuid AND j.status='FAILED'
  AND NOT EXISTS (SELECT 1 FROM offline_basemaps b WHERE b.package_id=j.package_id);
```

An existing basemap remains immutable. New package versions need their own
validated binding; the API does not fall back to an older version's raster.
An ongoing trip's locked package and its basemap remain available under existing
authorization rules. This work does not invalidate locked packages or change Trip
lifecycle. Existing bound rasters are not silently regenerated with the new buffer.

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
Preflight also rejects bounding boxes wider or taller than 50 km before any
network fetch/canvas allocation. Checkpoints can increase the requested area.
The 50 km guard is not a supported 50 x 50 km promise: the combined 5,000-cell
budget across zooms 12–16 usually rejects square areas earlier (roughly 35 km
per side at Son Tra's latitude, depending on grid alignment). Dense regions can
also reach 100 MiB before the tile budget. Zoom is not silently reduced; that
would require a separately reviewed backend/mobile contract change.
Dateline-crossing/polar routes are rejected rather than downloading near-world
data. Large routes fail within these bounds and require a different rendering
deployment; support for every geographic route is not claimed. Overpass outages
consume retries. A regional extract service is preferable for production volume.
Raster rendering remains ways-only: no DEM/contours, multipolygon assembly or
guarantee of complete trail coverage. Attribution is © OpenStreetMap contributors.
Tile hash diversity is a rejection heuristic, not proof of map accuracy.

The current source is live raw OSM via Overpass, not a preloaded Vietnam extract.
Any small region within the supported Mercator/size limits can be requested;
source availability and completeness are not guaranteed. There is no baked-in
Son Tra region restriction. For production throughput use an operator-managed
compatible Overpass source; do not point this variable at a rendered-tile server.
An operator-managed source with agreed capacity, rate limits and monitoring is
a production rollout prerequisite. The public endpoint is for development/demo
checks, not evidence of production throughput readiness.

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

## 2026-11-14 extension verification

The preceding 2026-11-10 counts are historical. Latest checks for the generic
per-trip coverage/worker extension:

- Node policy: 9 tests; Python renderer: 7 tests.
- Package/basemap Jest unit regression: 7 suites, 69 tests.
- Existing package generation/download HTTP E2E regression: 2 suites, 39 tests.
- Isolated PostgreSQL integration: 2 suites, 19 tests, including two competing
  actual worker processes, Python renderer, immutable publisher, checkpoint
  coverage rejection, private download SHA-256, v2 not-ready isolation and stale
  heartbeat rejection. Raw OSM is served by an explicit deterministic fixture in
  this automated test; participant authorization is covered separately by the
  existing service/API regressions, not established by its fixture access port.
- Docker image build on Windows succeeded from a minimal copied backend context
  because Docker traversal of an unrelated AI cache is denied on this workstation.
  The repository-specific Docker ignore also restricts the intended build inputs.
  Node dependencies, Python/Pillow/SQLite smoke and production/registry Compose
  configuration checks passed. A container running the actual watch loop against
  an isolated schema in `ctms_test` reported healthy; that container and schema
  were removed after the check. This does not deploy the application stack.

Independent live OSM render checks (PNG/TMS MBTiles, zooms 12–16):

| Region | Bounds (west, south, east, north) | Tiles | Exact bytes | Unique tile hashes |
| --- | --- | --- | --- | --- |
| Son Tra | 108.26, 16.09, 108.30, 16.13 | 88 | 286720 | 66 |
| Da Lat | 108.42, 11.92, 108.46, 11.96 | 114 | 1921024 | 114 |

Da Lat download/render/validation took 37.76 seconds on this Windows workstation;
Son Tra elapsed time was not instrumented. Extract provenance, hashes, preview
PNGs, SQLite files and renderer reports are kept outside Git under the local
temporary `ctms307-live-basemaps` directory. These checks validate real map content
outside Son Tra, not real safety approvals or a complete offline-device journey.
Emulator/physical-device airplane-mode overlay verification and remote PR CI
remain separate acceptance steps. No binary map or source extract is committed.

## PR validation — final local run, 2026-11-14

Branch: `feat/CTMS-307-view-current-location-on-offline-map-preparation-logic`.
These results cover the current uncommitted implementation based on `3c16ea0c`;
they are not remote CI results or results for a future merge with develop.

| Command / scope | Result |
| --- | --- |
| `pnpm lint:all` | PASS; API clean, Web 0 errors / 10 warnings in files outside this task |
| `pnpm build:all` | PASS; API Nest build and Web TypeScript/Vite production build |
| `pnpm test:all` | PASS; API 214 suites / 2548 tests; Web 267 files / 1827 tests; AI 34 tests |
| `node --test services/api/scripts/offline-basemap-policy.test.cjs` | PASS; 9 tests |
| `python scripts/test_build_osm_raster.py` | PASS; 7 tests |
| Package + basemap PostgreSQL integration | PASS; 2 suites / 19 tests |
| Package generation + download HTTP E2E regression | PASS; 2 suites / 39 tests |
| Biome on changed integration test and `git diff --check` | PASS |

The 69 targeted package/basemap unit tests recorded above are a subset of the
2548 API unit tests, not additional tests to add to that total. Integration and
HTTP E2E are separate commands; they are not included in `pnpm test:all`.
The Web regression took 927.69 seconds on this workstation. AI completed with
one dependency deprecation warning and two local pytest-cache permission warnings;
all 34 AI tests passed. No unrelated source was changed to suppress warnings.

PR checklist text:

- [x] `pnpm lint:all` passed (0 errors; 10 Web warnings).
- [x] `pnpm build:all` passed.
- [x] `pnpm test:all` passed (API 2548; Web 1827; AI 34).
- [x] Task-specific policy, renderer, PostgreSQL integration and package HTTP E2E regression passed.
- [ ] Two-trip airplane-mode rendering/attribution verification on emulator or physical device.
- [ ] Required remote PR CI checks.

Integration/E2E used the isolated `ctms_test` database on local port 55451, not the
shared application database. This checkpoint does not claim whole-repository E2E
regression, device acceptance, production readiness, commit or push completion.

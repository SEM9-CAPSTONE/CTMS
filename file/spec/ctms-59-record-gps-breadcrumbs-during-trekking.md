# CTMS-059 — Record GPS Breadcrumbs During Trekking

## 1. Overview

Story: CTMS-059

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Record GPS Breadcrumbs during Trekking

Priority: Must Have

Goal: Capture reliable GPS samples/logs during an ongoing Trip for safety detection and later synchronization.

Acceptance Criteria:

- Runtime GPS sample interval: 10 seconds.
- Raw `gps_log` persistence boundary: 30 seconds.
- Logging only occurs for an ongoing Trip and eligible participant.
- Location permission is required.
- Logs preserve stable ID, event time, coordinates, accuracy and version context.
- Old coordinates must not be copied and represented as fresh GPS data.

## 2. Scope

### In Scope

- Runtime GPS sampling.
- GPS breadcrumb persistence.
- Stable local identity.
- Event time.
- Accuracy.
- Altitude/battery when available.
- Package/config version context.

### Out of Scope

- Off-route transition logic — CTMS-060.
- Sync implementation — CTMS-065.

## 3. Actors & Authorization

- Joined Camper.
- Assigned Porter.
- Mobile client/system.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-058.

Conditions:

- Trip = ongoing.
- Camper has joined OR Porter has valid Assignment.
- Location permission granted.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-237 | GPS breadcrumb logging may occur only while the Trip is ongoing and the user is either a joined Camper or a Porter with a valid assignment for that Trip, and only after location permission has been granted. Logging must stop once Trip/participation state no longer permits tracking. Logs are identified by user + Trip, not by device identity. |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                  |
| BR-368 | During an ongoing Trip, the GPS sampling interval is fixed at one sample every 10 seconds in V3. Admins and clients must not be able to change this interval.                                                                                                                                                                                           |
| BR-396 | The GPS logging interval is fixed at one log every 30 seconds in V3. gps_log must use an appropriate sample at the logging boundary and must not fabricate a location by copying a stale sample without quality/staleness context.                                                                                                                      |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                   |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                            |

## 6. State & Lifecycle

Eligible ongoing participation
→ tracking active.

Every 10s:
→ runtime GPS sample.

Every 30s logging boundary:
→ eligible sample persisted as GPS log.

Trip/participation no longer eligible
→ tracking stops.

## 7. Business Flow

1. Confirm Trip ongoing.
2. Confirm user participation/Assignment.
3. Confirm location permission.
4. Start 10-second runtime sampling.
5. Evaluate sample freshness/quality.
6. Use samples for local safety detection.
7. At each 30-second logging boundary, persist appropriate GPS sample.
8. Attach stable UUID/local ID.
9. Preserve event time and version context.
10. Stop tracking when eligibility ends.

## 8. Data & Invariants

Each persisted log includes:

- stable UUID/local ID;
- user;
- Trip;
- event time;
- latitude;
- longitude;
- accuracy;
- package/config version;
- altitude when available;
- battery when available.

Important:

`device_id` is not the logical owner of breadcrumb history.

No fabricated fresh coordinate from stale sample.

## 9. API / Integration Contract

Local persistence first.

Device-side buffering and retry belong to CTMS-064/065. The server-side acceptance endpoint was delivered under CTMS-059-T01 (see Section 13):

- `GET /api/trips/:tripId/gps-tracking/context` (Camper/Porter): whether the caller may record breadcrumbs now (BR-237), with the fixed sampling/logging intervals (BR-368/396) and the tracking config version.
- `POST /api/trips/:tripId/gps-logs` (Camper/Porter): synchronizes up to 100 captured logs; each log gets its own `accepted` / `duplicate` / `rejected` outcome (BR-244).

## 10. Error & Edge Cases

| Case                           | Expected                                |
| ------------------------------ | --------------------------------------- |
| Trip not ongoing               | No tracking                             |
| Camper not joined              | No tracking                             |
| Porter not assigned            | No tracking                             |
| Permission denied              | No GPS logging                          |
| No new GPS sample              | Do not invent coordinate                |
| App/device temporarily offline | Local capture continues where supported |
| Participation ends             | Stop logging                            |

## 11. Acceptance & Test Matrix

| Scenario              | Expected                                   |
| --------------------- | ------------------------------------------ |
| Ongoing eligible Trip | GPS sampling starts                        |
| 10 seconds elapsed    | New runtime sample requested               |
| 30-second boundary    | GPS log persisted                          |
| Trip completed        | Logging stops                              |
| Permission revoked    | Logging stops                              |
| Stale coordinate      | Not represented as fresh sample            |
| Device changes        | Logical history remains user + Trip scoped |

## 12. Open Decisions

Background-location OS permissions and power-management implementation belong to Technical Design.

Pending Decisions (raised during CTMS-059-T01, not resolved by any PB/BR value):

- **Server-side retention period for `gps_logs`.** The Jira task asks to "enforce approved retention", but no retention period has been approved. Rows are kept indefinitely and are append-only (no update/delete path) until a period is decided.
- **Trip `ongoing` transition.** `TripStatus.ONGOING` exists but no flow moves a Trip into it yet, so live tracking eligibility (BR-237) cannot become true outside seeded data until the Trip start transition is implemented.
- **Authoritative Porter Assignment.** CTMS-047 `porter_assignments` does not exist yet; Porter eligibility reads the legacy `trip_porters.status = assigned` behind a replaceable source.

## 13. Implementation Record

CTMS-059-T01 (Jira CTMS-309) — system-side Preparation + Logic.

- **New `gps-tracking` API module** with migration `1787200000000-CreateGpsLogsTable` creating `gps_logs`: client UUID as primary key, `trip_id`, `user_id`, `participant_role`, `event_time` (timestamptz, BR-188), PostGIS `location`, `accuracy_meters`, optional `altitude_meters` / `battery_level`, optional `package_version`, required `config_version`, and server `received_at`. Ownership is user + Trip; no device column (BR-237, Section 8). Check constraints guard accuracy ≥ 0 and battery 0–100.
- **Fixed V3 intervals are code constants, not configuration** (BR-368/396 say they must not be changeable): sampling 10 s, logging 30 s, config version `v3`, exposed through the tracking-context endpoint.
- **Scope pulled forward from CTMS-065 (approved by the user before implementation):** the Jira task requires the system to "accept synchronized breadcrumb records with stable identity … without creating duplicates", which this spec's Section 2 had placed in CTMS-065. The idempotent acceptance endpoint is implemented here; client buffering/retry remains in CTMS-064/065.
- **Idempotency (BR-244):** one `INSERT … ON CONFLICT (id) DO NOTHING RETURNING id` per batch, so retried and concurrent uploads of the same UUID never create a second row. A UUID already stored for the same user + Trip is reported `duplicate`; a UUID owned by another user/Trip is `rejected` with `ID_CONFLICT` and the original row is never overwritten.
- **No fabricated coordinates (BR-396, Section 8):** the server stores exactly the submitted sample; latitude/longitude/accuracy are required and range-checked, and `event_time` is the device capture time (never the upload or boundary time), so a stale sample cannot be represented as fresh.
- **Synced vs local data (BR-226):** `received_at` records server acceptance; per-log outcomes let the client mark each item synced or rejected.

Judgment calls (spec silent; chosen by the user/agent and recorded here):

- **Live eligibility vs late synchronization.** The context endpoint applies BR-237 literally (Trip `ongoing` + Camper `joined` or Porter `assigned`). Synchronization must also accept logs captured offline and uploaded after the Trip ended, so a log is accepted when the Trip is `ongoing` or `completed` and its `event_time` falls inside the caller's participation window: scheduled `starts_at`–`ends_at`, narrowed for a Camper to after `checked_in_at` and, if they `left`, before `left_at`. Camper statuses `registered`, `no_show`, `removed` and unassigned Porters are rejected (`PARTICIPATION_NOT_ELIGIBLE`).
- **Participation source.** A Camper counts only through a Booking in `confirmed` or `completed` status. A user who is not a Camper member or Porter of the Trip at all gets `403`; an unknown Trip `404`. A user linked both ways is treated in whichever capacity currently allows tracking.
- **Batch handling.** Malformed payloads (missing/out-of-range coordinates, timestamp without offset, non-UUID id, more than 100 logs) are rejected as a whole with `422`; business rejections are per log so one bad log never blocks the rest of a client buffer.

## 14. Test Evidence

- Unit: `gps-tracking.service.spec.ts` (23) + `dto/create-gps-logs.dto.spec.ts` (11) = 34 new tests covering valid and violation paths of BR-237, BR-244, BR-368/396 and BR-188 — `pnpm --filter @ctms/api test` -> 1136/1136 passed (97/97 suites).
- Integration (`test/gps-tracking.integration-spec.ts`, real Postgres, no mocking), 23 passed: tracking context for joined/registered Camper, assigned/unassigned Porter, non-ongoing Trips, outsider (403), Host role (403), unknown Trip (404); persistence of exact time/coordinates/context; retry duplicate; **5 concurrent uploads of one UUID store exactly one row**; foreign UUID reuse rejected without overwrite; late sync for a completed Trip; rejections for never-started Trip, non-joined Camper, unassigned Porter, out-of-window sample; per-log outcomes in a mixed batch; 422 with nothing stored for a missing coordinate or offset-less timestamp.
- Full integration suite re-run with the new table and endpoints: `pnpm --filter @ctms/api test:integration` -> 327/327 passed (35/35 suites), no regression in other modules.
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.
- Backend-only task: no UI, so no screenshots.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules and invariants implemented.
- [x] Task-specific unit tests added or updated.
- [x] Task-specific unit tests passed.
- [x] Applicable backend or integration tests passed.

## 15. Implementation Record — CTMS-059-T02 (Jira CTMS-310), mobile UI

- **New Flutter feature `lib/features/gps_tracking/`:**
  - `GpsTrackingController` (one per Trip, Riverpod family) asks the server tracking context first and records only when `eligible` is true and location permission is granted (BR-237). It re-reads eligibility every 5 minutes and stops as soon as the Trip or participation is no longer trackable or the permission is revoked.
  - Sampling and logging intervals come from the server context (10 s / 30 s, BR-368/396); the client exposes no setting to change them.
  - At each logging boundary the latest sample captured since the previous boundary is persisted (`selectBoundarySample`). Without a fresh sample nothing is logged and the panel says so; an old coordinate is never re-logged as new (BR-396). The sample keeps the platform fix time as `eventTime`, sent as UTC with offset (BR-188).
  - Each log gets a device-generated UUID v4 and carries coordinates, accuracy, altitude when available and `configVersion`; it is owned by user + Trip, not by device.
- **Local-first buffer:** `FileGpsLogStore` keeps one JSON file per Trip in private app storage, isolated by account. `update` serializes read-modify-write so a new log appended while an upload result is recorded is never lost; one store instance is shared by tracking and the device sync screen.
- **Upload with per-log outcome (`synchronizeGpsLogs`):** batches of at most 100; `accepted`/`duplicate` → synced, `rejected` → failed with the server reason (final), transport errors → pending with exponential backoff (5 s … 300 s).
- **UI:** `GpsTrackingPanel` (built on `CtmsSectionCard`, `CtmsStatusBadge`, `CtmsAlertBanner`, `CtmsButton`, colours from the active `ColorScheme`, so it follows the dark theme): status, latest sample with freshness (stale after 30 s), pending/synced/rejected counts, recent logs, permission request and "Đồng bộ ngay".
  - Camper trip detail: the hard-coded sample GPS list was replaced by the panel.
  - Porter "Bản đồ": the hard-coded "GPS Đang bật" card was replaced by the panel for the Porter's ongoing assigned Trip (from `GET /trips/assigned`).
  - Device sync (CTMS-067): `pendingGpsCount` now comes from the real buffer and "Thử lại" also uploads pending GPS logs.
  - iOS location usage text now also mentions GPS recording.

Judgment calls (approved by the user on 2026-10-25):

- Basic upload and retry are implemented here because the Jira DoD requires backend integration and visible pending/sync/error state; the full buffer and synchronization behaviour stays in CTMS-064/065.
- Recording runs while the app is open. Background location and power management remain a Technical Design decision (Section 12).
- `batteryLevel` is left empty: no battery package is installed and no new dependency was added. `packageVersion` is empty until offline packages (EPIC-08) exist.
- Altitude `0` from the platform is treated as "not available".

Pending issues found (not fixed in this task):

- `develop` has two DI bugs that stop the API from booting: `import type { TripsService }` in `trip-review-deadline.service.ts`, and `import type` of `TripsRepository` / `EventsGateway` in `trips.service.ts` (from the CTMS-56 merge). They were patched locally only to run the app.
- In the camper trip detail, the existing CTMS-067 action row overflows when its label is rendered wider; the screen still uses hard-coded light colours in dark mode. Both belong to the ongoing mobile UI refactor.

## 16. Test Evidence — CTMS-059-T02

- `flutter analyze`: no issues.
- `flutter test`: 157 tests passed (new: `gps_tracking_models_test.dart`, `gps_log_store_sync_test.dart`, `gps_tracking_controller_test.dart`, `gps_tracking_panel_test.dart` with light and dark themes; `device_sync_test.dart` GPS cases).
  - Covered: eligible start, not-eligible and no-permission paths, permission granted later, boundary log with capture time and config, no fresh sample → no log, offline buffering then upload, permission revoked and eligibility lost → stop, offline recheck keeps the last decision, accepted/duplicate/rejected outcomes, backoff, 422 failure, batches of 100, concurrent appends and append during upload.
- Backend integration on the local stack: the tracking context returned `eligible: true` (10 s / 30 s, `v3`) for a checked-in Camper of an ongoing Trip; logs built with `LocalGpsLog.toPayload` were `accepted`, and re-sending them returned `duplicate`.
- Screens rendered from the real widgets (camper trip detail, dark and light theme) are attached to the PR; no Android emulator was available on this machine, so device screenshots are still to be taken.

### UI Subtask DoD

- [x] UI implementation completed
- [x] Applicable client-side behavior implemented
- [x] Task-specific unit/component tests passed
- [x] Backend integration completed
- [ ] Task-specific E2E tests passed (no device/emulator available)
- [x] All Story Acceptance Criteria verified (unit/widget level)
- [x] Unit regression tests passed
- [ ] E2E regression tests passed (no device/emulator available)
- [x] lint:all passed (mobile `flutter analyze`)
- [x] build:all passed (no API/web change; mobile analyze clean)
- [x] test:all passed (mobile `flutter test`)
- [ ] Required CI checks passed


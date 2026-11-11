# CTMS-084 — View Active Trekking Trips on Map

## 1. Overview

Story: CTMS-084

Epic: EPIC 14. Host Operations and Monitoring

Use Case: View Active Trekking Trips on Map

Priority: Must Have

Goal: Allow Host to monitor authorized active Trips on an operational map using route/checkpoint context and the latest server-synced participant locations.

Backlog story: As a Host, I want to view active trekking Trips on a map so I can monitor ongoing Trip operations.

Acceptance Criteria:

| Source  | Criterion                                                                    |
| ------- | ---------------------------------------------------------------------------- |
| PB AC-1 | Host map displays active Trips within Host authorization scope.              |
| PB AC-2 | Map displays applicable Route/checkpoint operational context.                |
| PB AC-3 | Map displays applicable Trip members.                                        |
| PB AC-4 | Map displays assigned Porters.                                               |
| PB AC-5 | Map uses the latest synchronized location the Host is authorized to view.    |
| PB AC-6 | Location timestamp/state is visible.                                         |
| PB AC-7 | Stale/offline data is visually distinguished and not presented as real-time. |

## 2. Scope

### In Scope

- Active Trip operational map.
- Route/checkpoints.
- Members.
- Assigned Porters.
- Latest synced locations.
- Location freshness/state.

### Out of Scope

- Unsynced device-local locations.
- Historical breadcrumb analysis.
- Route editing.

## 3. Actors & Authorization

Primary actor:

- Host.

Host may view only Trips and participant information within authorized operational scope.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-066.
- Active Trip and applicable Route context exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-266 | The Host map must display active Trips together with the operational Route/Checkpoint context, members, assigned Porters, and the latest synchronized locations the Host is authorized to view.                                                                                             |
| BR-267 | Location data must clearly display timestamp and state. Stale/offline data must be visually distinguishable and must not be presented as real-time.                                                                                                                                         |
| BR-246 | For each eligible Trip member, the Host view must show the latest synchronized location, last_seen_at, and synchronized safety flags such as OFF_ROUTE, Checkpoint, or behind-schedule. Data still unsynced on the device must not be presented as though the server knows it in real time. |

## 6. State & Lifecycle

Map query
→ authorization
→ active Trips resolved
→ route/checkpoint context loaded
→ latest synced positions loaded
→ freshness/state classified
→ rendered.

## 7. Business Flow

1. Host opens operational map.
2. Resolve authorized active Trips.
3. Load Route/checkpoint context.
4. Load eligible members and assigned Porters.
5. Load latest synchronized location.
6. Determine timestamp/freshness/state.
7. Render entities on map.
8. Visually distinguish stale/offline information.

## 8. Data & Invariants

Location display includes applicable:

- latitude/longitude;
- last synchronized timestamp;
- synchronization/freshness state.

Unsynced local device location must not be represented as server-known current position.

## 9. API / Integration Contract

Implemented by **CTMS-369 — Preparation + Logic** (backend only).

- `GET /api/host/monitoring/active-trips?page=1&limit=20`
- `GET /api/host/monitoring/active-trips/:tripId/participants/:role/:participantId`

Both endpoints require an active authenticated Host and return `Cache-Control: private, no-store`.
Authorization uses the server-granted role and `trips.host_id`. Only `ONGOING` Trips are eligible.
Detail reads return the same 404 for missing participants, inactive Trips and out-of-scope Trips.
Invalid pagination, UUIDs or participant roles return 422. No authenticated session returns 401;
an authenticated non-Host returns 403.

List pagination applies to Trips, with deterministic `starts_at, id` ordering. `page` defaults to 1
(maximum 1,000,000), and `limit` defaults to 20 (maximum 100). `total` remains the full authorized
Trip count, including when the selected page is empty. Each Trip includes its current persisted
Route geometry, ordered Route checkpoints, and the applicable participants. No Route/Trip write,
lifecycle change, package generation or GPS/safety ingest change is performed by this projection.

Participants follow the existing GPS eligibility sources: booking members with `JOINED` or `LEFT`
status on `CONFIRMED`/`COMPLETED` bookings, plus Porters with `ASSIGNED` status in `trip_porters`.
Registered, removed, no-show and cancelled-booking members are excluded. Members without a linked
user remain visible with an unavailable location; no other member's location is substituted.
`participantId` is the booking-member ID for role `camper`, or the assigned user's ID for role
`porter`. Names and identifiers are included; contact details, health profiles and credentials
are excluded.

Response metadata includes `generatedAt`, `locationSource: "server_confirmed"`, and
`freshnessMaxAgeSeconds`. Each participant contains:

- `location`: nullable accepted GPS sample (`id`, latitude/longitude, `accuracyMeters`,
  `eventTime`, `receivedAt`). Latest means descending capture `event_time`, then `received_at`
  and ID for deterministic ties, scoped by Trip, user and participant role. A delayed upload
  of an older capture cannot replace the latest position.
- `lastSeenAt`: capture time of that latest accepted position, not upload time. This is the
  API's camelCase representation of `last_seen_at`; it is not a connection heartbeat.
- `locationAgeSeconds`: elapsed capture age at response generation, floored to seconds and
  clamped to zero for future captures; null when no position exists.
- `freshness`: `fresh` when capture age is between zero and the configured threshold inclusive;
  `stale` for older or future-dated captures; `unavailable` when no accepted location exists.
- `safety.route` and `safety.gps`: latest accepted transition in each independent event family,
  with its capture and receipt timestamps. Recovery transitions supersede earlier warnings.
- `safety.lastCheckpoint`: latest server-persisted checkpoint visit for that booking member,
  including arrival time and receipt (`created_at`) time.
- `safety.behindSchedule`: null because no authoritative behind-schedule source exists yet.
  Null safety context means unknown/unavailable, never an assertion that the member is safe.

`HOST_TRIP_MAP_FRESHNESS_MAX_AGE_SECONDS` defaults to **120 seconds** and must be a positive safe
integer. This is a configurable display threshold, not a change to GPS collection or Trip rules.
Fresh means a recent server-confirmed capture; neither endpoint claims real-time location or
infers online/offline connectivity. Unsynced local samples/events are absent from this projection.
Consumers must distinguish stale/unavailable state and recompute freshness or refetch as time
passes using the returned timestamps and threshold.

The read model uses one PostgreSQL statement snapshot for authorization, count, Route/checkpoints,
participants and synchronized context. Source/database errors fail the request rather than
fabricating an empty list or a safe state. OpenAPI response schemas are registered with both endpoints.

## 10. Error & Edge Cases

| Case                   | Expected Behavior                  |
| ---------------------- | ---------------------------------- |
| Active authorized Trip | Display                            |
| Unauthorized Trip      | Hide/reject                        |
| Latest location recent | Display with timestamp/state       |
| Location stale         | Visually mark stale                |
| Participant offline    | Do not claim real-time             |
| No synced location     | Show appropriate unavailable state |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result              | Test Type |
| ------ | ------------------------ | ---------------------------- | --------- |
| BR-266 | Active Trip              | Map context displayed        | E2E       |
| BR-266 | Assigned Porter          | Displayed                    | UI        |
| BR-267 | Stale position           | Marked stale                 | UI        |
| BR-267 | Offline participant      | Not represented as real-time | Safety    |
| BR-246 | Unsynced device location | Not shown as server-known    | Integrity |

## 12. Open Decisions

Exact visual freshness categories belong to UI/Technical Design unless defined elsewhere.

CTMS-369 supplies `fresh/stale/unavailable` as the backend contract above; visual treatment remains
outside this backend task. `trip_porters` is the existing assignment source (also used by GPS
participation); migrate this read source when an authoritative `porter_assignments` implementation
becomes available. Behind-schedule detection is a separate dependency and is not implemented here.

## 13. CTMS-369 Backend Verification

Verified locally on 2026-10-29:

- [x] Read-only map aggregation and participant detail implemented.
- [x] Host scope, active Trip filtering, synchronized data selection and freshness invariants covered.
- [x] Task-specific unit tests: 18 passed.
- [x] Task-specific PostgreSQL/HTTP integration tests: 9 passed on `ctms_test`, with database-name
  safety checks before fixture creation and cleanup.
- [x] Related GPS/safety/overview/map regression: 98 unit tests across 6 suites and 54 integration
  tests across 4 suites passed.
- [x] Complete backend unit suite: 1,558 tests across 137 suites passed.
- [x] Backend ESLint, TypeScript no-emit check, Nest build and Biome check for changed TypeScript passed.

Commands used from `services/api` (existing local dependencies):

```text
node node_modules/jest/bin/jest.js --config jest.config.js --runInBand --silent
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand host-trip-map gps-tracking safety-events host-overview
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Backend scripts `pnpm --filter @ctms/api lint` and `pnpm --filter @ctms/api build` passed from the
repository root. Initial sandboxed pnpm attempts could not reach the registry to verify its pinned
version; the authorized retries succeeded. No dependency/package-manager settings were changed.

Frontend/mobile, repository-wide `lint:all`/`build:all`/`test:all`, the full integration suite and
remote CI were not run for this backend-only task. Visual acceptance remains in the UI task.
No development seed/reset, migration, commit, push or PR creation was performed.

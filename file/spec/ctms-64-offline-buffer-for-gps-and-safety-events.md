# CTMS-064 — Offline Buffer for GPS and Safety Events

## 1. Overview

Story: CTMS-064

Epic: EPIC 10. Offline Buffer and Synchronization

Use Case: Offline Buffer for GPS and Safety Events

Priority: Must Have

Goal: Preserve GPS logs and safety events durably while offline so safety behavior continues and pending data survives app/device restart.

Backlog story: As the System, I want to buffer GPS and safety events offline so connectivity loss does not destroy operational safety data.

Acceptance Criteria:

| Source  | Criterion                                                                            |
| ------- | ------------------------------------------------------------------------------------ |
| PB AC-1 | GPS logs are persisted locally while offline.                                        |
| PB AC-2 | Safety events are persisted locally while offline.                                   |
| PB AC-3 | Pending data survives app close/reopen and device restart.                           |
| PB AC-4 | OFF_ROUTE/checkpoint/safety detection continues locally from Offline Safety Package. |
| PB AC-5 | Local pending data is distinguishable from server-confirmed data.                    |

## 2. Scope

### In Scope

- Durable local database.
- Pending GPS logs.
- Pending safety events.
- App restart survival.
- Device restart survival.
- Local safety processing.

### Out of Scope

- Reconnection synchronization — CTMS-065.
- Sync status UI — CTMS-067.

## 3. Actors & Authorization

- Mobile client.
- Local persistence/safety subsystem.

## 4. Preconditions & Dependencies

Dependencies include applicable GPS/safety stories and Offline Safety Package.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-242     | When connectivity is lost, GPS logs and safety events must be stored in a local database so they survive app restarts or device restarts. OFF_ROUTE, Checkpoint, and other safety warnings must continue to operate locally from the Offline Safety Package. |
| BR-226     | Offline-capable features must clearly distinguish local pending data from server-confirmed synchronized data and must not present unsynced local data as authoritative server state.                                                                         |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                        |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                 |

## 6. State & Lifecycle

Generated locally
→ `pending`
→ remains durable while offline.

Synchronization transition belongs to CTMS-065.

## 7. Business Flow

1. GPS/safety subsystem generates record/event.
2. Detect network unavailable or use local-first persistence.
3. Assign stable identity/context.
4. Persist in local database.
5. Mark local synchronization state pending.
6. Continue local safety processing.
7. App closes/restarts.
8. Reload pending data.
9. Await synchronization workflow.

## 8. Data & Invariants

- Pending records survive restart.
- Unsynced ≠ server-confirmed.
- Original event identity/time/context preserved.
- Safety detection does not depend on server connectivity.

## 9. API / Integration Contract

Local database contract: TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                        |
| ---------------------------- | ---------------------------------------- |
| Internet lost                | Local persistence continues              |
| App killed                   | Pending data survives                    |
| Device restarted             | Pending data survives                    |
| OFF_ROUTE offline            | Local warning still operates             |
| Local pending item displayed | Clearly not represented as server-synced |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result               | Test Type   |
| ------ | -------------------- | ----------------------------- | ----------- |
| BR-242 | Offline GPS log      | Persisted                     | Offline     |
| BR-242 | Offline safety event | Persisted                     | Offline     |
| BR-242 | Restart app          | Data remains                  | Persistence |
| BR-242 | Restart device       | Data remains                  | E2E         |
| BR-226 | Pending item         | Not shown as server-confirmed | UI/Data     |

## 12. Open Decisions

Local database technology and retention/storage limits belong to Technical Design unless separately fixed.

## 13. Implementation Record

CTMS-064 (Jira CTMS-64) — Offline Buffer for GPS and Safety Events.

- **Local Storage Architecture (BR-242, PB AC-1, PB AC-2):**
  - Implemented atomic file-based persistence stores in Mobile (`apps/mobile/lib/features/`):
    - `GpsLogStore` (`FileGpsLogStore`): Stores breadcrumb GPS records per trip in isolated user storage (`gps-logs/<account>/<tripId>.json`). Atomically flushes to temporary files before renaming to eliminate partial-write or crash hazards.
    - `RouteDeviationStore` (`FileRouteDeviationStore`): Stores navigation state, GPS quality, and confirmed safety transitions (`route-deviation/<account>/<tripId>.json`).
- **Restart & Crash Durability (BR-242, PB AC-3):**
  - Both stores persist pending records in private application support storage.
  - When the app is terminated, crashes, or the device restarts, newly instantiated stores reload existing pending telemetry without loss of event UUIDs, timestamps, or coordinates.
- **Offline Safety Processing (BR-242, PB AC-4):**
  - `RouteDeviationController` caches the trip route geometry and configuration (`RouteDeviationContext`). When network connectivity is severed (`isOnline() == false`), the controller continuously processes GPS samples, checks distance thresholds against the local route cache, and records `OFF_ROUTE` transitions directly into the local store with `detectedOffline = true` and `syncState = pending`.
- **Pending vs Synced Distinction (BR-226, PB AC-5):**
  - `DeviceSyncController` strictly separates `pendingGpsCount` and `pendingSafetyCount` from `serverConfirmedGpsCount` and `serverConfirmedSafetyCount`. Unsynced records are never displayed or counted as server-confirmed.
- **Seeding for Verification (`main.seed.ts`):**
  - Seeded dedicated ongoing trip `DEMO_OFFLINE_BUFFER_TRIP_ID` (`c3958000-0064-4064-8064-000000000064`) with Camper (`camper@ctms.local`) in `joined` status and Porter (`porter@ctms.local`) in `assigned` status, ready for live tracking, airplane mode simulation, and offline buffer testing.

## 14. Test Evidence

Comprehensive automated test suite delivered at:
`apps/mobile/test/features/sync/ctms_064_offline_buffer_test.dart`

Covered scenarios (6/6 passed):
1. **PB AC-1 (BR-242)**: GPS logs are persisted locally while offline with `pending` sync status.
2. **PB AC-2 (BR-242)**: Safety events (`OFF_ROUTE`, `GPS_DEGRADED`) are persisted locally while offline.
3. **PB AC-3 (BR-242)**: Pending data survives complete app close/reopen and device reboot simulation (re-instantiated from filesystem).
4. **PB AC-4 (BR-242)**: Local safety detection computes route distance and confirms `OFF_ROUTE` offline without network dependency.
5. **PB AC-5 (BR-226)**: Local pending counters are strictly distinguished from server-confirmed counts.
6. **BR-213 Violation Path & Edge Cases**: Rejection of malformed / path-traversal trip IDs with `ArgumentError`, graceful handling of non-existent files.

Command to run tests:
```bash
cd apps/mobile
flutter test test/features/sync/ctms_064_offline_buffer_test.dart
```
Result: `All tests passed!` (6/6).

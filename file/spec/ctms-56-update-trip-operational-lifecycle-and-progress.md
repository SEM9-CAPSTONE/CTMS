# CTMS-056 — Update Trip Operational Lifecycle and Progress

## 1. Overview

Story: CTMS-056

Epic: EPIC 4. Trip Management

Use Case: Update Trip Operational Lifecycle and Progress

Priority: Must Have

Goal: Let an assigned Porter confirm actual Trip departure and completion, and maintain authoritative checkpoint progress with offline checkpoint synchronization.

## 2. Scope

### In Scope

- Assigned Porter confirms Start Trip and End Trip on mobile.
- Database-controlled actual timestamps, actor attribution, atomic audit and idempotent transitions.
- Departure eligibility and required offline-package checks.
- Operational Trip progress.
- Checkpoint arrival confirmation.
- Member checkpoint visits.
- Arrival time.
- GPS metadata when available.
- Offline capture/synchronization.
- Duplicate prevention.

### Out of Scope

- Automatic checkpoint detection — CTMS-061.
- GPS breadcrumb generation.
- Trip creation/publishing.

## 3. Actors & Authorization

- Assigned Porter.
- System.
- Joined Trip members as subjects of checkpoint visits.

## 4. Preconditions & Dependencies

Trip exists.

Porter has valid Trip Assignment.

Checkpoint belongs to applicable Route/Trip context.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-234     | A Porter may confirm checkpoint arrival only for a Trip where the Porter has a valid assignment and for a valid Checkpoint. The system must upsert checkpoint visits for joined members with arrival time and GPS metadata when available, support offline capture with later sync, and prevent duplicate arrival records. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                      |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                               |

## 6. State & Lifecycle

Assigned-Porter lifecycle: `published → ongoing → completed` through explicit Porter confirmation.
Unassigned/pending-reconfirmation Porters cannot operate a Trip. Draft, pending-approval,
rejected and cancelled Trips cannot start. Ending requires ongoing; a never-started Trip
cannot complete directly. Repeating a successful action returns current state without rewriting
timestamps or creating another audit. Starting a completed Trip is rejected.

The schedule worker retains its legacy path only for Trips without an assigned or
pending-reconfirmation Porter and without an actual start timestamp. It cannot start or
finish assigned Trips, including when the scheduled end has passed. Existing completed
Trips and historical timestamps are not backfilled or rewritten.

For checkpoint progress:

not visited
→ checkpoint arrival confirmed
→ checkpoint visit recorded.

Repeated confirmation does not create duplicate visit.

## 7. Business Flow

1. Assigned Porter selects Trip/checkpoint.
2. Validate Assignment.
3. Validate checkpoint.
4. Identify joined members.
5. Capture authoritative arrival time.
6. Include GPS metadata when available.
7. Upsert checkpoint visit for applicable members.
8. If offline, preserve operation for later synchronization.
9. Sync idempotently.
10. Update operational progress projection.

## 8. Data & Invariants

- Porter must be assigned.
- Checkpoint valid for Trip context.
- Only joined members receive applicable visit records.
- One logical arrival must not become duplicate visits.
- Offline sync preserves original event context.

## 9. API / Integration Contract

All endpoints require an authenticated, active Porter with a current `assigned` row.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/trips/:tripId/lifecycle` | Current status, planned/actual times, `canStart`, `canEnd`, `startBlockedReason`; private/no-store |
| POST | `/api/trips/:tripId/lifecycle/start` | Confirm departure; no client-supplied time or state |
| POST | `/api/trips/:tripId/lifecycle/end` | Confirm completion; no client-supplied time or state |

Start requires server time at/after `starts_at` and before `ends_at`, active Route,
no weather pause, and confirmed Booking participation at least `capacity_min`.
Pending-payment and pending-reconfirmation Bookings do not count. A required offline
package must pass the existing `PackageActivationService.assertDepartureReady` check
regardless of the schedule worker's feature flag; successful departure locks its version.
Blocked package diagnostics persist without a Trip state transition.

Writes lock the Trip, revalidate and lock the Assignment, retain the Route through commit,
then update status, actual timestamp and acting Porter together with `trip.started` or
`trip.ended` audit. Concurrent retries serialize. Package lock and lifecycle update roll
back together on failure. Planned `starts_at`/`ends_at` are retained.

Added nullable columns: `actual_started_at`, `actual_ended_at`, `started_by_id`, `ended_by_id`.
The database records actual times; legacy ongoing Trips may finish with unknown actual
start time. Finishing does not complete Bookings, settle revenue, initiate refunds or
change checkpoint visits; those keep their own authorized workflows.
The existing 24-hour complaint window and 72-hour settlement hold are measured from
`actual_ended_at` when available, retaining their legacy completion/schedule fallback
for historical Trips. Ending early or late never silently changes the window lengths.

Mobile: **Lịch → Xem chuyến đi** reads real assigned Trips and presents separate
confirmation dialogs for departure/completion, Vietnamese reasons and existing SnackBar
feedback. Start/end require connectivity and are not queued offline. After timeout/failure,
the client reloads current state before retrying. Checkpoint offline capture remains in
the existing checkpoint flow.

## 10. Error & Edge Cases

| Case                  | Expected                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| Unassigned Porter     | Reject                                                                      |
| Invalid checkpoint    | Reject                                                                      |
| Repeated confirmation | Upsert/no duplicate                                                         |
| Offline               | Store for later sync                                                        |
| Same event resynced   | No duplicate                                                                |
| GPS unavailable       | Arrival may still use allowed non-GPS context; do not fabricate coordinates |

## 11. Acceptance & Test Matrix

| Scenario                 | Expected        |
| ------------------------ | --------------- |
| Assigned Porter confirms | Visits recorded |
| Unassigned Porter        | Rejected        |
| Duplicate confirmation   | No duplicate    |
| Joined members           | Correct visits  |
| Offline then reconnect   | Idempotent sync |

## 12. Open Decisions

No new Trip status enum is introduced. The explicit Porter transitions above amend the
former schedule-only behavior for assigned Trips. Offline lifecycle actions are outside
this implementation; offline checkpoint events retain their original context.

## 13. Implementation verification

- `test/trips.lifecycle.integration-spec.ts`: HTTP authorization, invalid states/times,
  route/weather/participation blocks, required-package retry, concurrent idempotency,
  transactional rollback, schedule-worker exclusion, and financial isolation.
- `test/trips.status-schedule.integration-spec.ts`: legacy schedule behavior remains valid.
- `apps/mobile/test/features/trip_operations/trip_operations_test.dart`: live schedule
  navigation, both confirmations, cancel, disabled departure, in-flight operation and errors.
- Main seed: `pnpm --filter @ctms/api seed:porter-lifecycle`; additive daily fixtures reuse
  primary accounts and preserve all already-operated Trip/Booking records.

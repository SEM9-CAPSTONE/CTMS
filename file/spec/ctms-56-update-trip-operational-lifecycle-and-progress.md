# CTMS-056 — Update Trip Operational Lifecycle and Progress

## 1. Overview

Story: CTMS-056

Epic: EPIC 4. Trip Management

Use Case: Update Trip Operational Lifecycle and Progress

Priority: Must Have

Goal: Maintain authoritative operational Trip progress and checkpoint-arrival information while supporting Porter-led checkpoint confirmation and offline synchronization.

## 2. Scope

### In Scope

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

Operational Trip lifecycle follows authoritative Trip states.

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

TBD — Technical Design.

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

Exact Trip lifecycle enum/transitions remain governed by the authoritative Trip state model rather than being redefined here.

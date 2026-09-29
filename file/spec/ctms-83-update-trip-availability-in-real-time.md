# CTMS-083 — Update Trip Availability in Real Time

## 1. Overview

Story: CTMS-083

Epic: EPIC 13. Real-Time Communication

Use Case: Update Trip Availability in Real Time

Priority: Should Have

Goal: Keep displayed Trip capacity synchronized with authoritative booking-state changes without reintroducing the removed Locked/Released slot model.

Backlog story: As a user, I want Trip availability to update in real time so I can see current capacity without manually refreshing.

Acceptance Criteria:

| Source  | Criterion                                                                          |
| ------- | ---------------------------------------------------------------------------------- |
| PB AC-1 | Booking-state changes affecting capacity trigger updated availability information. |
| PB AC-2 | Client receives updated `seats_taken`.                                             |
| PB AC-3 | Client receives updated remaining seats.                                           |
| PB AC-4 | Duplicate events are ignored.                                                      |
| PB AC-5 | UI must not display the removed Locked/Released slot model.                        |

## 2. Scope

### In Scope

- Real-time capacity update.
- seats_taken.
- remaining seats.
- Event deduplication.

### Out of Scope

- Capacity reservation/locking model.
- Booking transaction itself — CTMS-029.
- Overbooking prevention implementation — CTMS-024.

## 3. Actors & Authorization

- Eligible connected client.
- Booking/capacity subsystem.
- Real-time communication subsystem.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-024.
- CTMS-078.

An authoritative booking-state change modifies Trip capacity.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-264     | When a Booking state change affects capacity, the client must receive updated seats_taken and remaining-seat values in real time. Duplicate events must be ignored, and the UI must not display the retired Locked/Released slot model. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                   |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                            |

## 6. State & Lifecycle

Authoritative booking change
→ capacity recalculated
→ realtime availability event
→ client receives
→ duplicate check
→ availability display updated.

## 7. Business Flow

1. Booking state changes.
2. Backend commits authoritative capacity effect.
3. Determine current `seats_taken`.
4. Determine remaining seats.
5. Publish realtime availability update.
6. Client receives event.
7. Deduplicate.
8. Update displayed availability.

## 8. Data & Invariants

Relevant values:

- capacity_max;
- seats_taken;
- remaining seats.

Invariant:

`remaining = capacity_max - seats_taken`

according to authoritative capacity semantics.

UI must not recreate obsolete `Locked` / `Released` slot states.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                | Expected Behavior                      |
| ----------------------------------- | -------------------------------------- |
| Booking consumes capacity           | Availability updates                   |
| Booking releases capacity           | Availability updates                   |
| Duplicate event                     | Ignore duplicate                       |
| Old event arrives after newer event | Must not regress authoritative display |
| UI expects Locked slot              | Do not expose obsolete model           |

## 11. Acceptance & Test Matrix

| Source | Scenario            | Expected Result          | Test Type   |
| ------ | ------------------- | ------------------------ | ----------- |
| BR-264 | Capacity changes    | seats_taken updated      | E2E         |
| BR-264 | Capacity changes    | remaining seats updated  | E2E         |
| BR-264 | Duplicate event     | No duplicate effect      | Idempotency |
| BR-264 | UI renders capacity | No Locked/Released model | UI          |

## 12. Open Decisions

Realtime event schema/versioning belongs to Technical Design.

# CTMS-024 — Prevent Trip Overbooking

## 1. Overview

Story: CTMS-024

Epic: EPIC 4. Trip Management

Use Case: Prevent Trip Overbooking

Priority: Must Have

Goal: Ensure concurrent Booking operations can never commit participant occupancy above the Trip's authoritative maximum capacity.

Backlog story: As the System, I want to prevent Trip overbooking so confirmed/reserved participation never exceeds Trip capacity.

Acceptance Criteria:

| Source  | Criterion                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------- |
| PB AC-1 | Backend calculates authoritative occupied/reserved capacity.                                       |
| PB AC-2 | A Booking that would exceed `capacity_max` must not commit.                                        |
| PB AC-3 | Concurrent requests for remaining capacity must be serialized/protected.                           |
| PB AC-4 | Booking cancellation/expiry releases capacity according to the authoritative Booking-state policy. |
| PB AC-5 | Client-provided seat counters are not authoritative.                                               |
| PB AC-6 | Transaction failure or concurrency conflict cannot leave Booking and Trip capacity inconsistent.   |

## 2. Scope

### In Scope

- Authoritative Trip occupancy.
- Booking seat reservation.
- Capacity release.
- Concurrency protection.
- Transactional capacity mutation.
- Booking-state eligibility for capacity consumption.

### Out of Scope

- Trip capacity configuration.
- Payment implementation.
- Booking cancellation policy itself.
- Participant check-in.

## 3. Actors & Authorization

- System: authoritative capacity enforcement.
- Camper: indirectly triggers capacity changes through Booking workflows.

No client is allowed to directly set authoritative Trip occupancy.

## 4. Preconditions & Dependencies

- Trip exists.
- `capacity_max` is valid.
- Booking workflow requests a capacity change.
- Current Trip/Booking states are loaded authoritatively.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-067 | Any Booking operation that creates, confirms, cancels, or expires a Booking and changes seats_taken must run inside a transaction. Any failure must roll back both the Booking change and the seat counters.                                                                                                                                                   |
| BR-068 | Before checking or updating seats_taken, the backend must serialize concurrent changes for the same trip_id using a row lock, advisory lock, or equivalent concurrency-control mechanism.                                                                                                                                                                      |
| BR-069 | seats_taken counts only participants in Booking states that currently hold or commit capacity under policy, including at least pending_payment and confirmed. cancelled, expired, and completed Bookings must not increase held capacity. seats_taken is used to prevent overbooking; it is not the confirmed participant count used to evaluate capacity_min. |
| BR-070 | confirmed_participant_count is the sum of num_people for Bookings with status = confirmed that remain eligible to participate at the time of evaluation. pending_payment must not count toward capacity_min even though it still counts toward seats_taken while holding capacity.                                                                             |
| BR-071 | A new Booking is valid only when num_people > 0 and current seats_taken + num_people <= trips.capacity_max. Trip capacity_min and capacity_max are the sole participant-count limits for Booking capacity.                                                                                                                                                     |
| BR-072 | If a Booking transaction encounters a conflict, deadlock, or serialization failure, the system must roll back and return or retry according to a safe retry policy. seats_taken must never diverge from Booking state.                                                                                                                                         |

## 6. State & Lifecycle

Capacity is not an independent client-managed lifecycle.

Booking transition
→ determines whether Booking consumes capacity
→ authoritative occupancy changes atomically.

Booking cancellation/expiry
→ release applicable reserved capacity.

## 7. Business Flow

1. Booking operation requests N places.
2. Backend loads/protects authoritative Trip capacity.
3. Backend calculates current capacity consumption.
4. Backend evaluates Booking state and requested participant count.
5. If resulting occupancy exceeds `capacity_max`, reject.
6. Otherwise mutate Booking and capacity in one transaction.
7. Commit.
8. Release lock/concurrency guard.
9. Return authoritative remaining/occupied capacity as permitted.

## 8. Data & Invariants

Critical invariant:

`authoritative occupied seats <= capacity_max`

at every committed state.

Additional invariants:

- Client does not own `seats_taken`.
- Booking and capacity state cannot diverge.
- Released capacity cannot be released twice.
- One participant/seat reservation cannot be counted twice through retry.
- Occupancy derives only from eligible Booking/member states.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                               | Expected Behavior                           |
| ---------------------------------- | ------------------------------------------- |
| Capacity available                 | Commit Booking/capacity atomically.         |
| Capacity insufficient              | Reject without partial Booking.             |
| Two requests compete for last seat | Only valid capacity can commit.             |
| Booking expires                    | Release capacity once.                      |
| Booking cancelled                  | Release capacity once according to policy.  |
| Client sends fake `seats_taken`    | Ignore/reject as authoritative input.       |
| Deadlock/serialization conflict    | Roll back; controlled retry where designed. |
| Retry repeats successful operation | Do not consume capacity twice.              |

## 11. Acceptance & Test Matrix

| Source          | Scenario                        | Expected Result                     | Test Type   |
| --------------- | ------------------------------- | ----------------------------------- | ----------- |
| PB AC-1, BR-070 | Occupancy requested             | Derived from authoritative records  | Integration |
| PB AC-2, BR-071 | Request exceeds maximum         | Rejected                            | Boundary    |
| PB AC-3, BR-068 | Concurrent last-seat requests   | Capacity never exceeded             | Concurrency |
| PB AC-4, BR-067 | Booking cancelled               | Applicable capacity released once   | Integration |
| PB AC-4, BR-069 | Booking changes state           | Capacity consumption follows policy | State       |
| PB AC-5, BR-070 | Client manipulates seat counter | No authoritative effect             | Security    |
| PB AC-6, BR-072 | Transaction/concurrency failure | Rollback leaves consistent state    | Transaction |

## 12. Open Decisions

The exact set of Booking states that consume capacity must come from the authoritative Booking lifecycle and must not be inferred here.

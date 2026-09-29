# CTMS-037 — Update Member Check-In Status

## 1. Overview

Story: CTMS-037

Epic: EPIC 5. Booking and Payment

Use Case: Update Member Check-In Status

Priority: Should Have

Goal: Maintain the authoritative participation state of each Booking member during Trip operation without incorrectly changing Booking-level lifecycle.

Backlog story: As an authorized Trip operator, I want to update each member's check-in status so actual Trip participation is recorded.

Acceptance Criteria:

| Source  | Criterion                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Only members of an eligible confirmed Booking for the Trip may be checked in.                                                  |
| PB AC-2 | Check-in records `member_status = joined`, `checked_in_at`, and the responsible actor according to the authoritative contract. |
| PB AC-3 | Member check-in does not automatically complete the Booking.                                                                   |
| PB AC-4 | Member may later be recorded as left according to the operational workflow.                                                    |
| PB AC-5 | Eligible registered member who does not join may become `no_show` after the applicable threshold.                              |
| PB AC-6 | No-show stores its authoritative timestamp/actor and is not a Booking status.                                                  |
| PB AC-7 | Duplicate/stale member transitions must not create contradictory participation state.                                          |

## 2. Scope

### In Scope

- Member check-in.
- Joined state.
- Left state.
- No-show state.
- Participation timestamps.
- Actor attribution.
- State validation.

### Out of Scope

- Booking completion; CTMS-038.
- Trip lifecycle; CTMS-056.
- GPS tracking.

## 3. Actors & Authorization

- Authorized Host/Trip operator according to the mapped authorization rules.
- System worker where no-show automation applies.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-030.
- CTMS-031.

Booking/member/Trip must exist and be in eligible state.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-110     | Only a Booking with status = confirmed for the correct Trip may be checked in. The Trip must also be within the policy-defined state and time window that permits check-in.                               |
| BR-111     | Individual member check-in must set booking_members.member_status = joined, checked_in_at, and status_updated_by. Repeated requests must not create duplicate check-ins.                                  |
| BR-112     | Checking in a member does not automatically complete the Booking. The Booking remains confirmed until the completion flow is executed.                                                                    |
| BR-113     | A member with status removed, no_show, or left, or a member under a cancelled/expired Booking, must not be checked in. The actor must be an authorized Host or Porter for the Trip.                       |
| BR-114     | When a member leaves the Trip, the system must set member_status = left, left_at, and status_updated_by. A member must not be marked left before joined unless an audited override is explicitly allowed. |
| BR-118     | After the policy-defined check-in/departure point, a registered member who has not joined may transition to no_show. Manual or scheduled processing must prevent duplicate no-show marking.               |
| BR-119     | A no-show transition must store no_show_at and status_updated_by, using NULL when performed by a system job. The change must be audited when required by policy.                                          |
| BR-120     | booking_status does not include no_show. no_show is a booking_member state.                                                                                                                               |
| BR-048     | Trip membership is represented by bookings + booking_members. The system must not introduce a separate Trip Member entity as a second source of truth.                                                    |
| BR-172     | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                      |
| BR-176     | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                 |
| BR-177     | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                 |
| BR-180     | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                      |
| BR-181     | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                        |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                     |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                              |

## 6. State & Lifecycle

Conceptual member lifecycle:

registered
→ `joined`
→ `left`

Alternative:

registered
→ after applicable threshold
→ `no_show`

Exact enum names beyond source-defined values follow Data Dictionary.

Booking remains confirmed during individual member check-in and is not completed by this story.

## 7. Business Flow

1. Operator opens Trip participants.
2. Backend verifies actor/Trip.
3. Load Booking/member.
4. Validate Booking confirmed and Trip check-in eligibility.
5. Recheck current member state.
6. Apply joined/left/no-show transition.
7. Store authoritative timestamp.
8. Store responsible actor/system identity.
9. Audit where required.
10. Commit.
11. Return current participant state.

## 8. Data & Invariants

- `no_show` belongs to member, not Booking.
- `joined` stores check-in time.
- `left` stores applicable leave time.
- `no_show` stores no-show time.
- Check-in does not complete Booking.
- Invalid reverse/stale transition is rejected.
- Duplicate job/manual action does not duplicate no-show.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                     | Expected Behavior                        |
| ---------------------------------------- | ---------------------------------------- |
| Booking not confirmed                    | Reject check-in.                         |
| Member belongs to another Trip           | Reject.                                  |
| Member already joined                    | No duplicate transition.                 |
| No-show job runs twice                   | One no-show result.                      |
| Joined member targeted as no-show        | Reject/no-op according to current state. |
| Client attempts Booking status = no_show | Reject; no-show is member-level.         |
| Stale status update                      | Conflict.                                |

## 11. Acceptance & Test Matrix

| Source          | Scenario                           | Expected Result                                                  | Test Type   |
| --------------- | ---------------------------------- | ---------------------------------------------------------------- | ----------- |
| PB AC-1, BR-110 | Confirmed eligible member          | Check-in allowed                                                 | E2E         |
| PB AC-2, BR-111 | Check-in succeeds                  | Joined + timestamp/actor stored                                  | Integration |
| PB AC-3, BR-112 | One/all member checks in           | Booking not auto-completed                                       | State       |
| PB AC-4, BR-113 | Joined member leaves               | Left state recorded                                              | Integration |
| PB AC-5, BR-118 | Registered member misses threshold | No-show allowed                                                  | Worker      |
| PB AC-6, BR-119 | No-show occurs                     | Timestamp/actor recorded                                         | Integration |
| PB AC-6, BR-120 | No-show                            | Booking status unaffected by a nonexistent no_show Booking state | State       |
| PB AC-7, BR-181 | Concurrent/stale update            | No contradictory state                                           | Concurrency |

## 12. Open Decisions

Exact check-in/no-show time thresholds must come from the authoritative policy/configuration.

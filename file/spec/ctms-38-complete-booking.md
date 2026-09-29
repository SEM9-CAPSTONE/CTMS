# CTMS-038 — Complete Booking

## 1. Overview

Story: CTMS-038

Epic: EPIC 5. Booking and Payment

Use Case: Complete Booking

Priority: Should Have

Goal: Transition an eligible confirmed Booking to completed after Trip participation and required operational obligations have been resolved.

Backlog story: As the System/authorized operator, I want an eligible Booking to be completed so its experience can enter post-Trip workflows such as review.

Acceptance Criteria:

| Source  | Criterion                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------- |
| PB AC-1 | Only an eligible Booking associated with the completed Trip lifecycle may transition to completed. |
| PB AC-2 | Completion records authoritative `completed_at` and is idempotent.                                 |
| PB AC-3 | Equipment-rental obligations must be resolved before completion according to equipment policy.     |
| PB AC-4 | Only completed Booking enables review eligibility for the actual related experience.               |

## 2. Scope

### In Scope

- Validate Booking completion eligibility.
- Transition Booking to completed.
- Record authoritative completion time.
- Check equipment obligations.
- Enable downstream review eligibility.

### Out of Scope

- Completing Trip itself; CTMS-056.
- Equipment return processing; CTMS-041.
- Creating review.

## 3. Actors & Authorization

- System or authorized operator according to approved completion workflow.

Client cannot directly supply authoritative `completed_at`.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-037.
- CTMS-056.

Trip lifecycle and Booking state must permit completion.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-115     | A Booking may transition from confirmed → completed only after the Trip itself has status = completed and all required member/equipment conditions have been handled. Within the same transaction, the backend must set bookings.completed_at to the current server/database time. The transition must be idempotent, and the client must not supply completed_at. This timestamp is the authoritative start point for the review window. |
| BR-116     | Before completing a Booking that includes equipment rental, the system must confirm that each reservation has either been returned or has a recorded not_returned/damage outcome.                                                                                                                                                                                                                                                         |
| BR-117     | Only a completed Booking grants review eligibility, and the review target must be part of the actual experience associated with that Booking.                                                                                                                                                                                                                                                                                             |
| BR-048     | Trip membership is represented by bookings + booking_members. The system must not introduce a separate Trip Member entity as a second source of truth.                                                                                                                                                                                                                                                                                    |
| BR-180     | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                                                                      |
| BR-181     | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                                                                        |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                     |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                              |

## 6. State & Lifecycle

Eligible confirmed Booking
→ completion conditions satisfied
→ `completed`

Completion is terminal for this workflow unless another approved rule explicitly defines a later state.

## 7. Business Flow

1. Trip reaches completion-eligible lifecycle.
2. System/operator loads Booking.
3. Validate current Booking state.
4. Validate Trip relationship/state.
5. Check member/participation conditions required by policy.
6. If equipment rental exists, verify return or recorded exception workflow.
7. Recheck Booking state.
8. Set Booking completed.
9. Set server `completed_at`.
10. Commit.
11. Enable downstream review eligibility.

## 8. Data & Invariants

- Client does not set `completed_at`.
- Completion is idempotent.
- Booking cannot complete before lifecycle conditions.
- Unresolved equipment cannot silently disappear.
- Review eligibility derives from completed Booking.
- Review target must correspond to actual Booking experience.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior                     |
| ---------------------------- | ------------------------------------- |
| Trip not completion-eligible | Reject.                               |
| Booking cancelled/expired    | Reject.                               |
| Equipment still unresolved   | Block completion according to BR-116. |
| Booking already completed    | Idempotent/no duplicate side effects. |
| Client sends completed_at    | Ignore/reject as authoritative input. |
| Stale completion request     | Conflict/no invalid overwrite.        |

## 11. Acceptance & Test Matrix

| Source          | Scenario                           | Expected Result            | Test Type           |
| --------------- | ---------------------------------- | -------------------------- | ------------------- |
| PB AC-1         | Eligible Booking + completed Trip  | Completion allowed         | E2E                 |
| PB AC-2, BR-115 | Completion succeeds                | Server completed_at stored | Integration         |
| PB AC-2         | Completion repeated                | No duplicate transition    | Idempotency         |
| PB AC-3, BR-116 | Rental unresolved                  | Completion blocked         | Integration         |
| PB AC-3         | Rental returned/exception recorded | Completion may proceed     | Integration         |
| PB AC-4, BR-117 | Booking completed                  | Review eligibility opens   | E2E                 |
| PB AC-4         | Booking not completed              | Review not eligible        | Authorization/State |

## 12. Open Decisions

None beyond the authoritative equipment and Trip-lifecycle rules.

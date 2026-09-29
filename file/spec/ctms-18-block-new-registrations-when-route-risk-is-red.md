# CTMS-018 — Block New Registrations when Route Risk Is Red

## 1. Overview

Story: CTMS-018

Epic: EPIC 3. Weather Risk Assessment

Use Case: Block New Registrations when Route Risk Is Red

Priority: Must Have

Goal: Prevent new Trip registration/booking when the authoritative applicable Route risk is Red.

Backlog story:
As the System, I want to block new registrations when Route risk is Red so new participants cannot enter a Trip under prohibited risk conditions.

Acceptance Criteria:

| Source  | Criterion                                                                         |
| ------- | --------------------------------------------------------------------------------- |
| PB AC-1 | Booking/registration checks the authoritative applicable Weather Risk assessment. |
| PB AC-2 | New registration is blocked when applicable risk level is Red.                    |
| PB AC-3 | Blocked response explains the risk-related reason.                                |
| PB AC-4 | Client cannot bypass the block by submitting a different risk value.              |

## 2. Scope

### In Scope

- Evaluate applicable assessment during new registration/booking.
- Block prohibited Red-risk registration.
- Return reason/assessment context.
- Enforce decision at backend.

### Out of Scope

- Calculating Weather Risk.
- Cancelling existing bookings.
- Cancelling Trip.
- Refund.
- LLM advice.

## 3. Actors & Authorization

Primary actor: System.

Camper/booking client initiates the surrounding registration workflow, but backend makes the authoritative risk decision.

## 4. Preconditions & Dependencies

Dependency: CTMS-016.

An applicable Route/Trip Weather Risk assessment must be resolved according to approved policy.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-046 | A new Booking must not be created when the latest valid assessment for the Route used by the Trip has level = Red under the active policy. The backend must perform this check immediately before reserving capacity. |
| BR-047 | When a Booking is blocked by Weather Risk, the response/UI must show the reason and the assessment timestamp used for the decision, without exposing unnecessary internal data.                                       |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                      |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                 |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                          |

## 6. State & Lifecycle

Risk not prohibited
→ registration may continue to remaining booking rules.

Risk = Red
→ registration blocked
→ no new booking/registration side effect.

This story does not automatically cancel existing bookings.

## 7. Business Flow

1. New registration/booking is attempted.
2. Backend resolves Trip and Route.
3. Backend resolves applicable authoritative Weather Risk assessment.
4. Backend evaluates risk policy.
5. If Red, backend blocks new registration.
6. Response provides approved risk reason/context.
7. If not blocked, workflow continues to other booking validations.

## 8. Data & Invariants

- Risk validation occurs server-side.
- Red-risk block occurs before booking commit.
- Client-provided risk cannot override server assessment.
- Existing booking behavior is outside this story unless another rule explicitly changes it.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                              | Expected Behavior                                               |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Risk = Red                                        | New registration blocked.                                       |
| Client reports Green but server assessment is Red | Block.                                                          |
| Assessment changes during booking                 | Final authoritative check must prevent stale unsafe commit.     |
| No applicable assessment                          | Follow approved missing-assessment policy; do not invent Green. |
| Existing paid booking when risk becomes Red       | Not automatically cancelled by this story.                      |

## 11. Acceptance & Test Matrix

| Source | Scenario                                        | Expected Result                          | Test Type   |
| ------ | ----------------------------------------------- | ---------------------------------------- | ----------- |
| BR-046 | Red assessment                                  | Booking blocked.                         | E2E         |
| BR-047 | Red block                                       | Reason/context returned.                 | Integration |
| BR-175 | Client sends fake safe risk                     | Server result wins.                      | Security    |
| BR-046 | Concurrent risk turns Red before booking commit | Unsafe new registration does not commit. | Concurrency |

## 12. Open Decisions

The source does not define in this story what happens to existing bookings when risk later becomes Red.

That must remain separate from “block new registrations” unless another approved BR explicitly defines cancellation/reschedule behavior.

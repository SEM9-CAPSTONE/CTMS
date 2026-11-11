# CTMS-012 — Close or Reopen Route Based on Conditions

## 1. Overview

Story: CTMS-012

Epic: EPIC 2. Trekking Route and Checkpoint Management

Use Case: Close or Reopen Route Based on Conditions

Priority: Must Have

Goal: Allow an authorized Host to close or reopen a Route while protecting Trips and bookings that depend on that Route.

Backlog story:
As a Host, I want to close or reopen a Route based on conditions so unavailable routes cannot incorrectly support new operations.

Acceptance Criteria:

| Source  | Criterion                                                                                    |
| ------- | -------------------------------------------------------------------------------------------- |
| PB AC-1 | Authorized Route state change is persisted only from an allowed current state.               |
| PB AC-2 | Closing a Route affects future Route-dependent operations according to the approved policy.  |
| PB AC-3 | Existing published/ongoing Trip relationships are protected from unsafe Route-state changes. |
| PB AC-4 | Route state changes are auditable.                                                           |

## 2. Scope

### In Scope

- Close Route.
- Reopen Route.
- Validate current Route state.
- Protect dependent Trip/Booking workflows.
- Audit Route-state changes.
- Trigger post-commit effects where required.

### Out of Scope

- Route approval.
- Trip cancellation.
- Booking cancellation/refund.
- Creating Route.

## 3. Actors & Authorization

Primary actor: Host.

Backend verifies Host ownership/business scope over Route.

## 4. Preconditions & Dependencies

Dependency: CTMS-013.

Route must exist and have an authoritative current state.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-029 | A Route with status = closed or archived must not be used to create, submit, or publish new Trips, and must not accept new Bookings for Trips that have not yet started. The backend must re-check Route status at the time of the business operation.                                                              |
| BR-030 | If a Route that is already used by a published or ongoing Trip is closed for safety reasons, the system must record the action in the audit log and notify the affected Host, Porters, and Campers after the status change commits successfully. The system must not automatically delete the Trip or its Bookings. |
| BR-032 | A Route that is no longer permitted for operation may be moved to status = closed only by an authorized actor. Closing the Route must record the reason in the audit log and notify affected Trips.                                                                                                                 |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                  |
| BR-194 | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result.                                                                       |
| BR-195 | A single business event must not create duplicate notifications for the same recipient, target object, and event type.                                                                                                                                                                                              |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                               |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                        |

## 6. State & Lifecycle

Relevant conceptual lifecycle:

Approved/open Route
→ close
→ closed Route

Closed Route
→ reopen when conditions permit
→ available Route state

Exact Route enum values must follow the authoritative domain contract.

## 7. Business Flow

1. Host requests Route close/reopen.
2. Backend authorizes Host.
3. Backend loads current persisted Route state.
4. Backend evaluates dependent Trips/Bookings.
5. Backend verifies requested transition is permitted.
6. Route state changes atomically.
7. Audit record is written.
8. Required notifications/events occur after commit.

## 8. Data & Invariants

- Stale state cannot overwrite newer state.
- Closed Route cannot silently behave as available for new Route-dependent operations.
- Existing Trip relationships must follow their own approved lifecycle rather than being silently mutated.
- State change is auditable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                              | Expected Behavior                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Unauthorized Host                                 | Reject.                                                                 |
| Route already in requested state                  | Preserve consistent authoritative state; API idempotency semantics TBD. |
| Stale Route state                                 | Conflict.                                                               |
| Active/published/ongoing Trip prevents transition | Block according to approved Route/Trip policy.                          |
| Transaction fails                                 | Route retains previous state.                                           |
| Notification fails after commit                   | Route transaction remains authoritative; retry notification separately. |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result                      | Test Type   |
| ------ | ------------------------ | ------------------------------------ | ----------- |
| BR-180 | Allowed Route transition | State changes.                       | Integration |
| BR-181 | Stale request            | Conflict.                            | Concurrency |
| BR-030 | Dependent active Trip    | Approved protection policy enforced. | E2E         |
| BR-032 | Successful closure       | Audit exists.                        | Integration |
| BR-195 | Event retried            | No duplicate notification.           | Integration |

## 12. Open Decisions

BR-029, BR-030 and BR-032 are currently generated/malformed.

Exact Route states and the precise effect of closure on existing published/ongoing Trips must be taken from the authoritative Route/Trip policy before additional behavior is added.

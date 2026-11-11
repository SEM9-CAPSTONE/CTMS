# CTMS-013 — Approve Trekking Route

## 1. Overview

Story: CTMS-013

Epic: EPIC 2. Trekking Route and Checkpoint Management

Use Case: Approve Trekking Route

Priority: Must Have

Goal: Allow Admin to review a submitted Trekking Route and produce an authoritative approval or rejection outcome.

Backlog story:
As an Admin, I want to approve trekking routes so only reviewed routes can support downstream Trip publication.

Acceptance Criteria:

| Source  | Criterion                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------- |
| PB AC-1 | Admin can review a Route in the applicable approval state.                                         |
| PB AC-2 | Approval validates required Route information including geometry and safety-related configuration. |
| PB AC-3 | Route may be approved or rejected only through valid state transitions.                            |
| PB AC-4 | Approval/rejection is audited and downstream Trip binding uses approved Route data.                |

## 2. Scope

### In Scope

- Admin Route review.
- Validate Route approval state.
- Validate Route geometry/checkpoint/hazard information required by source.
- Approve Route.
- Reject Route.
- Audit decision.

### Out of Scope

- Route creation.
- Checkpoint creation.
- Hazard editing.
- Trip publication itself.

## 3. Actors & Authorization

Primary actor: Admin.

Only an authorized Admin may perform Route approval/rejection.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-006
- CTMS-010
- CTMS-011

Route must exist and be in an approval-eligible state.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-031 | An Admin may approve a Route only when route.status = pending_approval and the Route geometry, difficulty, required checkpoints/hazards, and all other mandatory Route data are valid. Approval transitions pending_approval → active. A request for changes transitions pending_approval → draft and must include a reason.                                                           |
| BR-032 | A Route that is no longer permitted for operation may be moved to status = closed only by an authorized actor. Closing the Route must record the reason in the audit log and notify affected Trips.                                                                                                                                                                                    |
| BR-033 | The rejected Route status must not be used. Only state transitions defined by the route_status enum are permitted.                                                                                                                                                                                                                                                                     |
| BR-037 | When a Trip is submitted or published, it must be bound to the exact approved Route version used for approval. Later Route changes must create a new version or equivalent immutable snapshot and must not silently alter the geometry, checkpoints, or hazards of an already-published Trip. A Trip that needs the new Route version must follow the material-change/reapproval flow. |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                                                                                   |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                   |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                     |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                                                                   |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                               |
| BR-194 | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result.                                                                                                                                          |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                           |

## 6. State & Lifecycle

Conceptual lifecycle supported by source:

Route submitted / `pending_approval`
→ Admin review
→ approved

or

Route submitted / `pending_approval`
→ Admin review
→ rejected

Exact enum values follow authoritative `route_status`.

## 7. Business Flow

1. Admin opens pending Route.
2. Backend verifies Admin authorization.
3. Backend loads current Route version/state.
4. Required geometry/checkpoint/hazard/difficulty information is validated.
5. Admin approves or rejects.
6. Backend validates current persisted state.
7. State transition commits atomically.
8. Audit record captures decision.
9. Post-commit event may notify relevant actor.

## 8. Data & Invariants

- Only approval-eligible Route can be reviewed.
- Stale Admin decision cannot overwrite newer Route state.
- Approved status must correspond to the reviewed Route version.
- Downstream Trip cannot treat an unapproved Route as approved.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                             | Expected Behavior                                                |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Non-Admin approval                               | Reject.                                                          |
| Route not pending approval                       | Conflict/reject.                                                 |
| Required Route safety/configuration data missing | Approval blocked.                                                |
| Two Admins decide concurrently                   | First authoritative transition wins; stale transition conflicts. |
| Route changed during review                      | Stale approval must not silently approve unreviewed version.     |

## 11. Acceptance & Test Matrix

| Source | Scenario                                 | Expected Result           | Test Type   |
| ------ | ---------------------------------------- | ------------------------- | ----------- |
| BR-031 | Complete pending Route approved by Admin | Approved.                 | E2E         |
| BR-033 | Reject eligible Route                    | Valid rejected state.     | E2E         |
| BR-172 | Host attempts approval                   | Rejected.                 | Security    |
| BR-181 | Concurrent Admin decisions               | Stale decision conflicts. | Concurrency |
| BR-191 | Approval/rejection                       | Audit record exists.      | Integration |

## 12. Open Decisions

BR-031/032/033/037 currently contain generated wording.

Exact mandatory approval checklist and exact `route_status` values must come from the authoritative data/rule source.

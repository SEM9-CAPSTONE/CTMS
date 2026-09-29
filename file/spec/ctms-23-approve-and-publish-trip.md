# CTMS-023 — Approve and Publish Trip

## 1. Overview

Story: CTMS-023

Epic: EPIC 4. Trip Management

Use Case: Approve and Publish Trip

Priority: Must Have

Goal: Allow an authorized Admin to review a submitted Trip and publish it only when its Trip configuration and referenced Route/version satisfy the approved requirements.

Backlog story: As an Admin, I want to review and approve a submitted Trip so only valid Trips become publicly available.

Acceptance Criteria:

| Source  | Criterion                                                                                  |
| ------- | ------------------------------------------------------------------------------------------ |
| PB AC-1 | Only an authorized Admin may make the Trip approval decision.                              |
| PB AC-2 | Only a Trip in the applicable approval state may be approved or rejected.                  |
| PB AC-3 | Approval validates the Trip's approved Route/version and required itinerary configuration. |
| PB AC-4 | A valid approved Trip becomes available through the published Trip lifecycle.              |
| PB AC-5 | An invalid Trip may be rejected according to the authoritative Trip lifecycle.             |
| PB AC-6 | AI-generated information cannot replace the deterministic approval rules.                  |
| PB AC-7 | Concurrent or stale approval requests must not produce contradictory Trip state.           |

## 2. Scope

### In Scope

- Admin review of submitted Trip.
- Verify Trip state.
- Verify approved Route/version.
- Verify required Trip/waypoint configuration.
- Approve eligible Trip.
- Reject ineligible Trip.
- Persist authoritative Trip state.
- Prevent stale/concurrent contradictory approval.
- Make successfully published Trip eligible for downstream public discovery.

### Out of Scope

- Creating Trip.
- Editing Trip waypoints.
- Editing/rescheduling published Trip.
- Booking.
- AI deciding whether a Trip is approved.

## 3. Actors & Authorization

- Admin: approval actor.
- Host: owner of submitted Trip; not the approval authority.
- System: validates and persists decision.

Only authorized Admin may approve/reject the Trip.

The current generated source has previously shown an actor mismatch in which Camper was labelled as primary actor. That label must not override BR-061/BR-062 and the approved Admin approval workflow.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-006.
- CTMS-022.

Preconditions:

- Admin authenticated and authorized.
- Trip exists.
- Trip has been submitted into the authoritative approval state.
- Required Trip configuration exists.
- Referenced Route/version remains eligible.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-061 | An Admin may publish a Trip only when status = pending_approval, the approved Route version remains valid, and all cross-table validation for time, capacity, trip_waypoints, and checkpoint-to-Route relationships succeeds. Publishing sets status → published and locks the reference/snapshot to the approved Route version used by that Trip.                                     |
| BR-062 | If a Trip fails approval criteria, the Admin must return it to draft and provide a reason. An overnight Trip with missing or incorrect overnight waypoints must not be published.                                                                                                                                                                                                      |
| BR-037 | When a Trip is submitted or published, it must be bound to the exact approved Route version used for approval. Later Route changes must create a new version or equivalent immutable snapshot and must not silently alter the geometry, checkpoints, or hazards of an already-published Trip. A Trip that needs the new Route version must follow the material-change/reapproval flow. |
| BR-218 | When trip_waypoint.checkpoint_id is not NULL, the backend must verify that the Checkpoint belongs to trips.route_id and must snapshot checkpoints.location into trip_waypoints.location. Later Checkpoint changes must not automatically alter the Trip's snapshotted location. When checkpoint_id = NULL, the Host must provide a valid custom location.                              |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                                                                                   |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                   |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                     |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                           |

## 6. State & Lifecycle

Conceptually:

`draft`
→ submission
→ `pending_approval`

Then:

`pending_approval`
→ Admin approves
→ published/approved state defined by authoritative Trip enum

or:

`pending_approval`
→ Admin rejects
→ authoritative rejection outcome.

The spec must not invent a `rejected` Trip enum if the authoritative enum does not contain it. The exact rejection representation must follow the Data Dictionary/Domain Model.

## 7. Business Flow

1. Admin opens submitted Trip.
2. Backend verifies Admin authorization.
3. Backend loads authoritative current Trip.
4. Verify Trip is in approval-eligible state.
5. Verify approved Route/version.
6. Verify required Trip configuration.
7. Verify waypoint/overnight rules.
8. Admin chooses approve or reject.
9. Backend revalidates persisted state immediately before mutation.
10. Valid approval commits authoritative publish/approval state.
11. Valid rejection commits the approved rejection outcome.
12. Any downstream event occurs only from committed authoritative state.

## 8. Data & Invariants

- Only Admin makes approval decision.
- Approval uses current authoritative Trip state.
- Trip cannot be published from an ineligible state.
- Published Trip references the approved Route/version reviewed for that Trip.
- AI cannot substitute approval logic.
- Stale Admin request cannot overwrite newer state.
- One Trip cannot simultaneously commit contradictory approval outcomes.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                        | Expected Behavior                                          |
| ------------------------------------------- | ---------------------------------------------------------- |
| Non-Admin attempts approval                 | Reject.                                                    |
| Trip missing                                | Not found.                                                 |
| Trip not in approval state                  | Conflict.                                                  |
| Route/version no longer eligible            | Block approval.                                            |
| Required itinerary invalid                  | Block approval.                                            |
| AI recommends approval despite invalid rule | Block approval.                                            |
| Two Admins act concurrently                 | Only transition from authoritative current state succeeds. |
| Stale approval request                      | Conflict.                                                  |
| Transaction fails                           | Previous Trip state remains authoritative.                 |

## 11. Acceptance & Test Matrix

| Source          | Scenario                          | Expected Result                       | Test Type     |
| --------------- | --------------------------------- | ------------------------------------- | ------------- |
| PB AC-1, BR-172 | Admin reviews Trip                | Allowed                               | Authorization |
| PB AC-1         | Non-Admin approves                | Rejected                              | Security      |
| PB AC-2, BR-180 | Eligible approval state           | Decision may proceed                  | State         |
| PB AC-2, BR-181 | Stale state                       | Conflict                              | Concurrency   |
| PB AC-3, BR-037 | Valid approved Route/version      | Validation passes                     | Integration   |
| PB AC-3         | Invalid itinerary                 | Approval blocked                      | Integration   |
| PB AC-4, BR-061 | Valid Trip approved               | Authoritative publish state committed | E2E           |
| PB AC-5, BR-062 | Invalid submitted Trip rejected   | Approved rejection outcome persisted  | E2E           |
| PB AC-6, BR-218 | AI contradicts deterministic rule | Hard rule wins                        | AI Safety     |
| PB AC-7, BR-181 | Concurrent decisions              | No contradictory final state          | Concurrency   |

## 12. Open Decisions

- Exact Trip enum/state representing successful publication.
- Exact representation of Admin rejection if `rejected` is not a valid Trip status.
- Whether rejection returns Trip to `draft` or uses another approved review record/state must follow the authoritative domain model.

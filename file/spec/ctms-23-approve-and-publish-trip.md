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
| PB AC-8 | If a pending Trip is not approved within 24 hours after submission, the system automatically rejects it and notifies the Host. |
| PB AC-9 | Before the 24-hour approval deadline, the system reminds Admin users that the Trip is still pending review. |

## 2. Scope

### In Scope

- Admin review of submitted Trip.
- Verify Trip state.
- Verify approved Route/version.
- Verify required Trip/waypoint configuration.
- Approve eligible Trip.
- Reject ineligible Trip.
- Automatically reject pending Trips that exceed the 24-hour approval SLA.
- Notify Host when a Trip is automatically rejected.
- Remind Admin users before the 24-hour approval deadline.
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
- System: validates, persists decision, monitors approval deadline, sends review reminders, and performs automatic rejection after timeout.

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
- Admin review request includes the Trip `updated_at` value that the Admin reviewed.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-061 | An Admin may publish a Trip only when status = pending_approval, the approved Route version remains valid, and all cross-table validation for time, capacity, trip_waypoints, and checkpoint-to-Route relationships succeeds. Publishing sets status → published and locks the reference/snapshot to the approved Route version used by that Trip.                                     |
| BR-062 | If a Trip fails approval criteria, the Admin must return it to draft and provide a reason so the Host can revise and resubmit. An overnight Trip with missing or incorrect overnight waypoints must not be published.                                                                                                                                                                |
| BR-222 | A Trip in `pending_approval` must be reviewed within 24 hours after submission. If it remains unapproved when the 24-hour deadline passes, the system must change the Trip status to `rejected`, record an audit entry with the automatic rejection reason, and notify the Host.                                                                                                          |
| BR-223 | The system must notify eligible Admin users when a Trip enters `pending_approval` and must remind them before the 24-hour approval deadline if the Trip is still pending. Reminder delivery must be idempotent per Trip/deadline window.                                                                                                                                                 |
| BR-037 | When a Trip is submitted or published, it must be bound to the exact approved Route version used for approval. Later Route changes must create a new version or equivalent immutable snapshot and must not silently alter the geometry, checkpoints, or hazards of an already-published Trip. A Trip that needs the new Route version must follow the material-change/reapproval flow. |
| BR-218 | When trip_waypoint.checkpoint_id is not NULL, the backend must verify that the Checkpoint belongs to trips.route_id and must snapshot checkpoints.location into trip_waypoints.location. Later Checkpoint changes must not automatically alter the Trip's snapshotted location. When checkpoint_id = NULL, the Host must provide a valid custom location.                              |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                                                                                   |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                   |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                     |
| BR-219 | Admin review must target the latest pending Trip version. The review request must include the reviewed Trip `updated_at` value, and the backend must reject the decision if the Trip was edited after the Admin loaded that version.                                                                                                                                                    |
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
→ `draft`

or:

`pending_approval`
→ 24-hour approval deadline expires without approval
→ System automatically rejects
→ `rejected`

Rejected Trips are not public and are not eligible for booking unless a separate approved edit/resubmission workflow returns them to an editable state.

## 7. Business Flow

1. Admin opens submitted Trip.
2. Backend verifies Admin authorization.
3. Backend loads authoritative current Trip.
4. Verify Trip is in approval-eligible state.
5. Verify the submitted `reviewedUpdatedAt` matches current Trip `updated_at`.
6. Verify approved Route/version.
7. Verify required Trip configuration.
8. Verify waypoint/overnight rules.
9. Admin chooses approve or reject.
10. Backend revalidates persisted state immediately before mutation.
11. Valid approval commits authoritative publish/approval state.
12. Valid Admin rejection returns the Trip to `draft` with the Admin reason.
13. Any downstream event occurs only from committed authoritative state.

### Pending Approval SLA

1. Trip enters `pending_approval` after CTMS-022 validates and submits the complete Trip configuration.
2. System emits an Admin notification that a new Trip requires review.
3. System calculates the approval deadline as 24 hours after the Trip entered `pending_approval`.
4. Before the deadline, system emits an Admin reminder when the Trip is still pending.
5. If an Admin approves before the deadline, the Trip follows the normal approval path and no automatic rejection occurs.
6. If an Admin rejects before the deadline, the Trip returns to `draft` with the Admin reason and no automatic rejection occurs.
7. If the Trip remains `pending_approval` at or after the deadline, system rechecks the current Trip state under authoritative locking.
8. If it is still pending, system changes status to `rejected`, records the automatic rejection reason, and notifies the Host.
9. If the Trip changed state before the timeout job commits, the timeout job must not overwrite the newer state.

## 8. Data & Invariants

- Only Admin makes approval decision.
- Approval uses current authoritative Trip state.
- Approval or rejection must include the `updated_at` value that was reviewed.
- Trip cannot be published from an ineligible state.
- A Trip cannot remain indefinitely in `pending_approval`; unresolved pending review expires after 24 hours.
- Automatic rejection only applies while the Trip is still in `pending_approval`.
- Automatic rejection creates an auditable system decision and Host notification.
- Admin reminder for a pending Trip is idempotent for the same review window.
- Published Trip references the approved Route/version reviewed for that Trip.
- AI cannot substitute approval logic.
- Stale Admin request cannot overwrite newer state.
- One Trip cannot simultaneously commit contradictory approval outcomes.

## 9. API / Integration Contract

`PATCH /trips/:tripId/review`

Approve payload:

```json
{
  "action": "approve",
  "reviewedUpdatedAt": "2026-09-15T00:00:00.000Z"
}
```

Decline payload:

```json
{
  "action": "decline",
  "reviewedUpdatedAt": "2026-09-15T00:00:00.000Z",
  "reason": "Itinerary missing lunch stop"
}
```

The backend compares `reviewedUpdatedAt` to the locked Trip row's current `updated_at`. A mismatch is a business conflict and the Admin must reload the latest pending Trip before deciding.

## 10. Error & Edge Cases

| Case                                        | Expected Behavior                                          |
| ------------------------------------------- | ---------------------------------------------------------- |
| Non-Admin attempts approval                 | Reject.                                                    |
| Trip missing                                | Not found.                                                 |
| Trip not in approval state                  | Conflict.                                                  |
| Route/version no longer eligible            | Block approval.                                            |
| Required itinerary invalid                  | Block approval.                                            |
| Host edits Trip while Admin review is open  | Review request using old `updated_at` is rejected.         |
| AI recommends approval despite invalid rule | Block approval.                                            |
| Two Admins act concurrently                 | Only transition from authoritative current state succeeds. |
| Stale approval request                      | Conflict.                                                  |
| Pending Trip reaches reminder window        | Notify Admin once for that pending review window.          |
| Pending Trip exceeds 24-hour deadline       | System changes status to `rejected` and notifies Host.     |
| Admin approves before 24-hour deadline      | Publish/approval state wins; auto reject must not run.     |
| Admin rejects before 24-hour deadline       | Admin rejection wins; auto reject must not overwrite it.   |
| Timeout job races with Admin decision       | Only transition from authoritative current state succeeds. |
| Transaction fails                           | Previous Trip state remains authoritative.                 |

## 11. Acceptance & Test Matrix

| Source          | Scenario                          | Expected Result                       | Test Type     |
| --------------- | --------------------------------- | ------------------------------------- | ------------- |
| PB AC-1, BR-172 | Admin reviews Trip                | Allowed                               | Authorization |
| PB AC-1         | Non-Admin approves                | Rejected                              | Security      |
| PB AC-2, BR-180 | Eligible approval state           | Decision may proceed                  | State         |
| PB AC-2, BR-181 | Stale state                       | Conflict                              | Concurrency   |
| PB AC-2, BR-219 | Stale reviewedUpdatedAt           | Conflict                              | Unit/E2E      |
| PB AC-3, BR-037 | Valid approved Route/version      | Validation passes                     | Integration   |
| PB AC-3         | Invalid itinerary                 | Approval blocked                      | Integration   |
| PB AC-4, BR-061 | Valid Trip approved               | Authoritative publish state committed | E2E           |
| PB AC-5, BR-062 | Invalid submitted Trip declined by Admin | Trip returns to `draft` with reason | E2E           |
| PB AC-6, BR-218 | AI contradicts deterministic rule | Hard rule wins                        | AI Safety     |
| PB AC-7, BR-181 | Concurrent decisions              | No contradictory final state          | Concurrency   |
| PB AC-8, BR-222 | Pending Trip remains unapproved past 24 hours | Trip becomes `rejected`, audit entry is recorded, Host is notified | Unit / Integration / E2E |
| PB AC-8, BR-222 | Pending Trip is approved before 24 hours | Trip is not automatically rejected | Regression / E2E |
| PB AC-9, BR-223 | Pending Trip enters reminder window | Admin reminder notification is emitted once | Unit / Integration |
| PB AC-9, BR-223 | Trip enters `pending_approval` | Admin new-Trip notification is emitted | Integration / E2E |

## 12. Open Decisions

None.

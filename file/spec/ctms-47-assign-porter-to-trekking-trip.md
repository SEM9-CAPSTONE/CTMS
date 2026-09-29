# CTMS-047 — Assign Porter to Trekking Trip

## 1. Overview

Story: CTMS-047

Epic: EPIC 7. Porter Management

Use Case: Assign Porter to Trekking Trip

Priority: Must Have

Goal: Create the authoritative Trip-Porter Assignment only for an eligible Porter and valid Trip while preventing schedule conflicts and duplicate assignments.

Acceptance Criteria:

| Source  | Criterion                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------- |
| PB AC-1 | Authorized Host can assign eligible Porter to a Trip they manage.                                    |
| PB AC-2 | Assignment validates Porter availability and Route qualification.                                    |
| PB AC-3 | Assignment work range must not conflict with another committed assignment.                           |
| PB AC-4 | Duplicate Porter/Trip assignment is prevented.                                                       |
| PB AC-5 | Lead role requires applicable Route qualification.                                                   |
| PB AC-6 | Accepted Porter Request may be used as assignment context but does not bypass assignment validation. |

## 2. Scope

### In Scope

- Create Porter Assignment.
- Revalidate Porter.
- Assignment role.
- Work-range conflict.
- Route qualification.
- Accepted Request relationship where applicable.

### Out of Scope

- Request creation.
- Porter profile editing.
- Compensation.

## 3. Actors & Authorization

- Host managing Trip.
- System.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-021.
- CTMS-043.
- CTMS-046.

Porter must be eligible at assignment time.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-156 | A Porter may be assigned to a Trip only when an ACCEPTED Porter Request exists for that exact Trip/Porter pair, the Porter and qualification remain valid, and no schedule conflict exists at commit time. Porter Assignment is the authoritative source that reserves the Porter's schedule.                                                                       |
| BR-157 | porter_assignment.is_lead = true is valid only when the Porter has proficiency on the exact Route with value proficient or expert.                                                                                                                                                                                                                                  |
| BR-158 | A new Porter Assignment work_range must not overlap any existing active/accepted assignment for the same Porter. The concurrency check must be protected by the database/transaction layer. Multiple ACCEPTED Porter Requests may coexist, but only the first non-conflicting Assignment that successfully commits reserves the schedule.                           |
| BR-159 | A Porter's acceptance of a Porter Request constitutes consent for the Host to create an Assignment based on that accepted request. A second, duplicate accept/decline step for the Assignment is not required. If conditions change before Assignment creation, the backend must revalidate and may reject the Assignment without reverting the Request to PENDING. |
| BR-222 | Before committing a qualification, Porter Request, or Porter Assignment change, the backend must revalidate the current Porter/profile state, Route qualification, request/assignment state, and schedule-conflict rules.                                                                                                                                           |

## 6. State & Lifecycle

Eligible Porter
→ Assignment created
→ assigned/active assignment according to authoritative enum.

Request Accepted does not itself mean final Assignment unless the domain model explicitly couples the transition.

## 7. Business Flow

1. Host selects Trip/Porter.
2. Verify Host manages Trip.
3. Reload Porter profile.
4. Validate availability.
5. Validate Route qualification.
6. Validate requested role.
7. Check work-range overlap.
8. Check duplicate assignment.
9. Create assignment.
10. Commit.
11. Notify Porter after commit where applicable.

## 8. Data & Invariants

- Assignment references valid Trip and Porter.
- Host owns/manages Trip.
- No conflicting committed work range.
- Lead requires valid qualification.
- `learning` cannot qualify lead.
- Request acceptance cannot bypass final validation.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                            | Expected Behavior                                      |
| ------------------------------- | ------------------------------------------------------ |
| Unrelated Host assigns          | Reject.                                                |
| Porter became unavailable       | Reject.                                                |
| Schedule overlaps               | Reject.                                                |
| Lead qualification insufficient | Reject.                                                |
| Duplicate assignment            | Reject/idempotent existing result as contract defines. |
| Accepted request stale          | Revalidate; reject if no longer eligible.              |

## 11. Acceptance & Test Matrix

| Source  | Scenario                                 | Expected Result     | Test Type     |
| ------- | ---------------------------------------- | ------------------- | ------------- |
| BR-156  | Managing Host assigns                    | Allowed             | Authorization |
| BR-157  | Eligible Porter                          | Assignment created  | E2E           |
| BR-158  | Overlap exists                           | Rejected            | Boundary      |
| BR-159  | Duplicate assignment                     | Prevented           | Constraint    |
| BR-222  | learning Porter assigned lead            | Rejected            | Qualification |
| PB AC-6 | Accepted request but conflict now exists | Assignment rejected | Concurrency   |

## 12. Open Decisions

Whether accepted Request automatically creates an Assignment or requires an explicit Host action must follow the authoritative workflow; this spec does not collapse the two resources.

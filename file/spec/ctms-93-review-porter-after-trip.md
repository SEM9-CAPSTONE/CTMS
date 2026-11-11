# CTMS-093 — Review Porter after Trip

## 1. Overview

Story: CTMS-093

Epic: EPIC 16. Reviews and Feedback

Use Case: Review Porter after Trip

Priority: Should Have

Goal: Allow a Camper with completed participation to review a Porter who was actually assigned to that Trip.

Backlog story: As a Camper, I want to review each Porter who actually participated in my Trip so I can reflect the quality of their support.

Acceptance Criteria:

| Source  | Criterion                                                                          |
| ------- | ---------------------------------------------------------------------------------- |
| PB AC-1 | Only Camper with completed participation may review a Porter.                      |
| PB AC-2 | Porter must have an actual Assignment on the same Trip.                            |
| PB AC-3 | Backend resolves target Porter from Trip Assignment.                               |
| PB AC-4 | Review may be created or edited only within 24 hours after `booking.completed_at`. |
| PB AC-5 | Rating must be an integer from 1 to 5.                                             |
| PB AC-6 | Each Porter/participation may be reviewed at most once by the reviewer.            |
| PB AC-7 | Only eligible, non-excluded reviews contribute to aggregate Porter rating.         |

## 2. Scope

### In Scope

- Completed participation.
- Actual Porter Assignment verification.
- 24-hour review window.
- Rating/comment.
- Duplicate prevention.
- Eligible aggregate rating input.

### Out of Scope

- Trip/Host review — CTMS-092.
- Porter assignment creation — CTMS-047.
- AI review analysis.
- Moderation workflow.

## 3. Actors & Authorization

Primary actor:

- Camper.

Backend verifies:

- completed participation;
- Trip;
- Porter Assignment;
- review ownership.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-047.
- CTMS-038.

Camper has completed participation.

Target Porter had an actual Assignment on that Trip.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-297     | A Trip review may be created only by a Camper with an actual completed Booking/participation and only within 24 hours after booking.completed_at. The review must reference trip_id and a reviewer identity verified by the backend.                                                                                                                                                |
| BR-299     | A Porter may be reviewed only when the Porter had an actual assignment on the reviewer's Trip. The backend must resolve the review target from the Trip assignment.                                                                                                                                                                                                                 |
| BR-300     | A reviewer may create at most one review for the same target within the same Trip participation. Duplicate submissions must be rejected or handled idempotently. A Camper may edit their own review within the same 24-hour window after booking.completed_at; after that window, the Camper may no longer edit it, although moderation may still be performed according to policy. |
| BR-301     | rating must be an integer from 1 to 5. Both rating and comment must pass validation, and the original user review must be preserved unchanged as the authoritative input.                                                                                                                                                                                                           |
| BR-302     | Aggregate Host/Porter ratings must include only eligible reviews that have not been excluded by moderation. The system must store and display both rating average and rating count to avoid misleading interpretation.                                                                                                                                                              |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                              |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |

## 6. State & Lifecycle

Completed participation
→ Porter review eligible
→ review created
→ optional Camper edit within 24h
→ Camper edit window closes
→ eligible review contributes to aggregate unless excluded by moderation.

## 7. Business Flow

1. Camper opens completed Trip.
2. Backend verifies completed participation.
3. Load actual Porter Assignments for Trip.
4. Camper selects an eligible Porter.
5. Backend validates Porter Assignment.
6. Verify review window.
7. Check existing review for target/participation.
8. Validate rating/comment.
9. Persist review.
10. Include eligible review in Porter aggregate.
11. Permit owner edit only while review window remains open.

## 8. Data & Invariants

Review includes:

- reviewer;
- Trip/participation;
- backend-resolved Porter;
- rating;
- raw comment;
- timestamps.

Aggregate includes:

- rating average;
- rating count.

Invariants:

- Porter must have actual Trip Assignment;
- rating integer 1–5;
- one review per target/participation;
- moderated-ineligible reviews do not count toward aggregate.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                          | Expected Behavior                               |
| ----------------------------- | ----------------------------------------------- |
| Porter assigned to Trip       | Eligible                                        |
| Porter unrelated to Trip      | Reject                                          |
| Booking incomplete            | Reject                                          |
| >24h after completion         | Reject create/edit                              |
| Duplicate review              | No duplicate                                    |
| Rating outside 1–5            | Reject                                          |
| Review excluded by moderation | Exclude from aggregate                          |
| Multiple Porters assigned     | Each eligible Porter may be reviewed separately |

## 11. Acceptance & Test Matrix

| Source | Scenario                    | Expected Result       | Test Type   |
| ------ | --------------------------- | --------------------- | ----------- |
| BR-297 | Completed Camper within 24h | Eligible              | E2E         |
| BR-299 | Assigned Porter             | Review allowed        | Integration |
| BR-299 | Unassigned Porter           | Rejected              | Security    |
| BR-300 | Duplicate                   | Prevented             | Idempotency |
| BR-301 | Rating 1–5                  | Accepted              | Validation  |
| BR-302 | Eligible review             | Included in aggregate | Integration |
| BR-302 | Moderated-out review        | Excluded              | Integration |

## 12. Open Decisions

None for Porter eligibility and review-window rules.

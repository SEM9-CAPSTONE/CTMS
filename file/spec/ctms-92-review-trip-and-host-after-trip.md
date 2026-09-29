# CTMS-092 — Review Trip and Host after Trip

## 1. Overview

Story: CTMS-092

Epic: EPIC 16. Reviews and Feedback

Use Case: Review Trip and Host after Trip

Priority: Should Have

Goal: Allow a Camper who actually completed a Trip to review that Trip and its actual Host within the approved review window.

Backlog story: As a Camper, I want to review the Trip and actual Host after completing the Trip so I can share my experience.

Acceptance Criteria:

| Source  | Criterion                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Only a Camper with an actually completed Booking/participation may create the review.                                   |
| PB AC-2 | Review may be created only within 24 hours after `booking.completed_at`.                                                |
| PB AC-3 | Review is associated with `trip_id`.                                                                                    |
| PB AC-4 | Backend derives `host_id` from the Trip; client cannot select an unrelated Host.                                        |
| PB AC-5 | One reviewer may create at most one review for the same target within the same participation.                           |
| PB AC-6 | Rating must be an integer from 1 to 5.                                                                                  |
| PB AC-7 | Rating/comment must pass validation.                                                                                    |
| PB AC-8 | Camper may edit their own review within the same 24-hour window.                                                        |
| PB AC-9 | After the 24-hour window, Camper cannot edit the review; moderation may still change content state according to policy. |

## 2. Scope

### In Scope

- Completed-participation eligibility.
- Trip review.
- Actual Host relationship.
- 24-hour review window.
- Rating 1–5.
- Comment validation.
- Duplicate prevention.
- Owner edit within review window.

### Out of Scope

- Porter review — CTMS-093.
- Moderation handling — CTMS-105.
- AI review analysis — CTMS-107.
- Host selection by client.

## 3. Actors & Authorization

Primary actor:

- Camper.

Camper must have completed Booking/participation for the Trip.

Backend verifies reviewer identity and participation.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-038.

Booking/participation is completed.

Current time must be within:

`booking.completed_at + 24 hours`

for Camper create/edit operations.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-297     | A Trip review may be created only by a Camper with an actual completed Booking/participation and only within 24 hours after booking.completed_at. The review must reference trip_id and a reviewer identity verified by the backend.                                                                                                                                                |
| BR-298     | A Host may be reviewed only through a Trip the Host actually organized. The backend must derive host_id from trip_id and must not allow the client to select an unrelated Host.                                                                                                                                                                                                     |
| BR-300     | A reviewer may create at most one review for the same target within the same Trip participation. Duplicate submissions must be rejected or handled idempotently. A Camper may edit their own review within the same 24-hour window after booking.completed_at; after that window, the Camper may no longer edit it, although moderation may still be performed according to policy. |
| BR-301     | rating must be an integer from 1 to 5. Both rating and comment must pass validation, and the original user review must be preserved unchanged as the authoritative input.                                                                                                                                                                                                           |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                              |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |

## 6. State & Lifecycle

Completed participation
→ review window opens
→ review created
→ optionally edited by Camper
→ 24-hour window expires
→ Camper editing closed.

Review may later enter moderation flow according to applicable policy.

## 7. Business Flow

1. Camper opens completed Booking/Trip.
2. Backend verifies completed participation.
3. Verify current time is within 24 hours of `booking.completed_at`.
4. Resolve Trip.
5. Backend resolves actual Host from Trip.
6. Check duplicate review.
7. Camper enters integer rating 1–5 and optional/required comment according to validation.
8. Validate input.
9. Create review.
10. Camper may edit own review while review window remains open.
11. After window expiry, reject Camper edit.

## 8. Data & Invariants

Review preserves:

- reviewer identity;
- participation/Booking context;
- trip_id;
- backend-derived host_id;
- rating;
- original/raw comment;
- creation/update time.

Invariants:

- `1 ≤ rating ≤ 5`;
- rating is integer;
- Host must derive from Trip;
- maximum one review per reviewer/target/participation;
- Camper create/edit window = 24 hours after `booking.completed_at`.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                   |
| ------------------------------ | ----------------------------------- |
| Booking not completed          | Reject                              |
| Completed but >24h             | Reject create                       |
| Client supplies unrelated Host | Ignore/reject; backend derives Host |
| Rating 0 or 6                  | Reject                              |
| Non-integer rating             | Reject                              |
| Duplicate submit               | No duplicate review                 |
| Edit own review within 24h     | Allowed                             |
| Edit after 24h                 | Reject                              |
| Edit another Camper's review   | Reject                              |

## 11. Acceptance & Test Matrix

| Source | Scenario                           | Expected Result    | Test Type   |
| ------ | ---------------------------------- | ------------------ | ----------- |
| BR-297 | Completed participation within 24h | Review allowed     | E2E         |
| BR-297 | >24h                               | Rejected           | Boundary    |
| BR-298 | Client chooses unrelated Host      | Not accepted       | Security    |
| BR-300 | Duplicate submit                   | One review maximum | Idempotency |
| BR-301 | Rating 1–5 integer                 | Accepted           | Validation  |
| BR-301 | Rating outside range               | Rejected           | Negative    |
| BR-300 | Edit within window                 | Allowed            | Functional  |
| BR-300 | Edit after window                  | Rejected           | Boundary    |

## 12. Open Decisions

Comment length/content validation must follow the authoritative validation definition; no new numeric limit is introduced here.

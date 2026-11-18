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

### CTMS-389 implementation contract

Jira subtask: CTMS-389; parent story: CTMS-284. CTMS-093 is the specification ID.

Authentication: JWT plus the Camper role. The caller must be the linked
`booking_members.user_id`; owning the group booking alone does not authorize
reviews for another member. Booking, participation, Trip and reviewer identities
are resolved by the backend. `porterId` always refers to `users.id`, never to an
assignment request or a separate assignment identifier.

| Method | Route (including global prefix) | Input / output |
| --- | --- | --- |
| GET | `/api/bookings/:bookingId/porter-reviews/context` | Own participation eligibility, `serverTime`, `completedAt`, `expiresAt`, assigned Porter names and `canCreate`, plus own reviews and `canEdit` |
| POST | `/api/bookings/:bookingId/porter-reviews` | `{ porterId, rating, comment? }`; returns the persisted review (201) |
| PATCH | `/api/porter-reviews/:reviewId` | `{ rating, comment?, expectedRevision }`; returns the updated review (200) |

All timestamps are ISO 8601 UTC with `Z`. The review response contains
`id, bookingId, memberId, reviewerId, tripId, porterId, rating, comment,
revision, moderationStatus, editExpiresAt, createdAt, updatedAt`. IDs are internal
references; clients must show the provided Porter name, never a UUID fallback.
Context adds `porterName` (nullable) and `canEdit` to each own review. A missing
name means unavailable display information, not permission to show an ID.

Context `eligible` means completed participation inside the creation window with
at least one current assignment. Per-Porter `canCreate` additionally rejects an
existing review. `reviews[].canEdit` is independent of current assignments.
Generic ineligibility reasons are `PARTICIPATION_NOT_COMPLETED`,
`WINDOW_EXPIRED` and `NO_ELIGIBLE_ASSIGNMENT`; the API does not disclose
assignment history or other users' reviews.

#### Eligibility and assignment changes

- Creation requires a completed booking, a linked member in `joined` status,
  a check-in no later than completion, no departure, and non-future completion.
- Only `trip_porters.status = assigned` on this exact Trip qualifies for a new
  review. Pending reconfirmation, unassigned rows and request-only records do not.
  The current data model has no authoritative historical assignment intervals.
- A Porter removed before creation cannot be newly reviewed, including removal
  during the Trip. This is an approved limitation of using current assignments.
- A review validly created before assignment removal is retained, remains editable
  until its original deadline, and contributes to ratings unless hidden or its
  participation becomes ineligible. Assignment removal or re-assignment does not
  create a second review opportunity.
- Both creation and editing close at `booking.completed_at + 24 hours`
  (exclusive). A persisted `editExpiresAt` preserves the original deadline;
  creation/edit timestamps never extend it. PostgreSQL comparisons account for
  the millisecond precision of Node.js dates.
- The 24-hour rule for both operations and retention after removal are decisions
  approved during CTMS-389 implementation, not inferred from request timestamps.

#### Input and persistence

Rating is an integer 1–5. Comment is optional, at most 2,000 Unicode characters
after trimming outer whitespace; blank becomes null. Inner text and markup are
preserved, never interpreted as HTML. Clients must render user text safely.
On PATCH, omitting comment preserves it; null or blank clears it. Unknown fields,
including target/author/Trip/member changes, are rejected.

`porter_reviews` has a unique `(member_id, reviewer_id, porter_id)` constraint,
restricting foreign keys and `moderation_status` restricted to `visible|hidden`.
Assignment is checked under a shared row lock during creation. Participation
writes are serialized; edits additionally lock the review and compare
`expectedRevision`. The clock is read after lock waits. Review, immutable
`porter_review_revisions` snapshots and identity/version-only audit records commit
atomically. Audit does not copy private comment content.

The internal `PorterReviewsRepository.ratingSummary(manager, porterId)` query is
the aggregate input for CTMS-413. It returns `{ porterId, ratingAverage,
ratingCount }`, with null average and zero count when empty. It counts each
current review once, excludes hidden reviews and ineligible participation, and
does not require a still-active assignment. Expiry ends editing, not the rating's
validity. No public reputation endpoint or moderation action is introduced here.

| HTTP | Code / meaning |
| --- | --- |
| 401 | Authentication required |
| 403 | Camper role required |
| 404 | `PORTER_REVIEW_NOT_FOUND`: missing/out-of-scope booking, linked participation, assignment or own review; identical response |
| 409 | `PARTICIPATION_NOT_COMPLETED`, `WINDOW_EXPIRED`, `DUPLICATE_REVIEW`, `REVIEW_EDIT_CLOSED`, or `STALE_REVISION` |
| 422 | Invalid UUID/body/rating/comment/revision or unexpected fields |

Clients map these codes to natural Vietnamese feedback. CTMS-390 supplies UI;
CTMS-413 supplies reputation presentation/integration. Assignment creation,
Trip/Route behavior, AI analysis and moderation workflows remain outside CTMS-389.
Jira dependency direction discrepancies were observed during planning; Jira is
read-only and has not been changed.

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

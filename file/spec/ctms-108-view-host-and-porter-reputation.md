# CTMS-108 — View Host and Porter Reputation

## 1. Overview

Story: CTMS-108

Epic: EPIC 16. Reviews and Feedback

Use Case: View Host and Porter Reputation

Priority: Should Have

Goal: Display trustworthy Host/Porter reputation based on eligible user ratings without exposing unrelated private operational data.

Backlog story: As a user, I want to view Host and Porter reputation so I can understand rating history from eligible reviews.

Acceptance Criteria:

| Source  | Criterion                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------ |
| PB AC-1 | Aggregate rating uses only eligible reviews not excluded by moderation.                          |
| PB AC-2 | Display rating average.                                                                          |
| PB AC-3 | Display rating count.                                                                            |
| PB AC-4 | AI sentiment/topic does not replace numeric rating.                                              |
| PB AC-5 | Public reputation does not expose Booking member/internal Host/Porter data.                      |
| PB AC-6 | Reputation updates consistently after create/update/moderation without double-counting a review. |

## 2. Scope

### In Scope

- Host reputation.
- Porter reputation.
- Average rating.
- Rating count.
- Eligible review aggregation.

### Out of Scope

- Review creation.
- AI-derived sentiment as rating replacement.

## 3. Actors & Authorization

Eligible user may view permitted public reputation information.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-092.
- CTMS-093.

Eligible reviews exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-302 | Aggregate Host/Porter ratings must include only eligible reviews that have not been excluded by moderation. The system must store and display both rating average and rating count to avoid misleading interpretation. |
| BR-304 | AI-derived sentiment or topics must not replace the Camper's numeric rating when calculating reputation. Aggregate rating and AI insight are separate outputs.                                                         |
| BR-307 | Review/reputation APIs may expose only data approved for public visibility. They must not reveal Booking member data or unnecessary internal Host/Porter information.                                                  |
| BR-308 | Trip, Host, and Porter reputation must be updated consistently after review creation, update, or moderation, and the same review must never be double-counted.                                                         |

## 6. State & Lifecycle

Review create/update/moderation
→ eligibility recalculated
→ aggregate reputation updated
→ view.

## 7. Business Flow

1. User opens Host/Porter reputation.
2. Resolve eligible reviews.
3. Exclude moderation-ineligible reviews.
4. Avoid duplicate review contribution.
5. Calculate average/count.
6. Return permitted public data.

## 8. Data & Invariants

Reputation contains:

- rating average;
- rating count.

AI-derived sentiment is separate.

One review contributes at most once.

## 9. API / Integration Contract

CTMS-413 adds a numeric reputation projection to existing authenticated reads.

| Viewer | Existing API | Added field |
| --- | --- | --- |
| Camper with access to Trip details | `GET /api/trips/:tripId` | `hostReputation` |
| Host on their own Trips | `GET /api/trips/porter-assignments` | `assignments[].reputation` for assigned Porters |
| Host on their own Trips | `GET /api/trips/porter-requests/host` | `reputation` for pending invitations |
| Camper with access to their review context | `GET /api/bookings/:bookingId/porter-reviews/context` | `porters[].reputation` for current assignments and `reviews[].reputation` for the caller's own reviews, including removed assignments |

Trip detail requires authentication even for published Trips. A signed-in Camper
can receive Host reputation whenever the existing Trip detail rules permit access.
The existing detail and context lookups return the same 404 for absent and
inaccessible resources. The list APIs scope records by the authenticated Host.

An authorized target without eligible reviews returns
`{"reputation":{"ratingAverage":null,"ratingCount":0}}`. In another context,
such as a declined invitation, the entire field is omitted, for example
`{"status":"declined"}` (other existing fields omitted here for brevity).
An eligible aggregate may be `{"ratingAverage":4.333333333333333,"ratingCount":3}`.
The client formats the rating. The API returns the unrounded average.

The aggregate reads the current rating from each visible, eligible review.
Host reputation uses only `trip_reviews` with the Host target within the original
72-hour creation window. Porter reputation reads `porter_reviews` within the
original 24-hour creation window. These are distinct aggregates even when the
same account holds both roles. Valid Porter reviews remain eligible after the
assignment is removed. An eligible review counts immediately, including while
it can still be edited. Edits, hiding and restoring change the next read, and
revisions never add additional votes. Lists batch aggregates for distinct
subjects. CTMS-413 adds a partial Host index for visible Host-target reviews.
The earlier Host moderation index covers hidden rows only. Porter aggregation
uses its existing visible-review index.
The Host index migration creates and drops the index concurrently. The shared
TypeORM configuration uses one transaction per migration; this migration opts
out so PostgreSQL can build its index while allowing writes. A retry removes
an invalid index left by an interrupted build before rebuilding it.
To revert this concurrent index migration, run
`pnpm --filter @ctms/api run migration:revert --transaction none`.
The installed TypeORM revert path starts a transaction even when this
migration declares `transaction = false`, so rollback requires that option.

The projection contains only average and count. AI insights, review content,
reviewer identities and moderation notes are excluded. One eligible review is
enough to display a rating, so the average can equal that review's rating.
A suspended or soft-deleted reviewer retains eligible, visible contributions.
The reviewer foreign keys restrict hard deletion while referenced reviews exist.

## 10. Error & Edge Cases

| Case                        | Expected Behavior           |
| --------------------------- | --------------------------- |
| No eligible reviews         | Valid empty/no-rating state |
| Review updated              | Aggregate updates           |
| Review excluded             | Remove from aggregate       |
| Same review processed twice | No double-count             |
| Private Booking data        | Not exposed                 |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result           | Test Type   |
| ------ | -------------------- | ------------------------- | ----------- |
| BR-302 | Eligible reviews     | Correct average/count     | Data        |
| BR-308 | Review update        | Aggregate consistent      | Integration |
| BR-308 | Duplicate processing | No double-count           | Idempotency |
| BR-307 | Public response      | No unrelated private data | Security    |

## 12. Open Decisions

None.

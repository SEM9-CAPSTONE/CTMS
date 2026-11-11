# CTMS-106 — Receive Personalized Trip Recommendations

## 1. Overview

Story: CTMS-106

Epic: EPIC 4. Trip Management

Use Case: Receive Personalized Trip Recommendations

Priority: Should Have

Goal: Recommend eligible Trips using permitted preference/behavior signals while keeping authoritative Trip eligibility rules ahead of AI ranking.

Backlog story: As a Camper, I want personalized Trip recommendations so I can discover eligible Trips relevant to my preferences.

Acceptance Criteria:

| Source  | Criterion                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Candidate Trips must be published, before booking deadline, not started/completed, have capacity, valid Route, and pass Weather Risk hard rules. |
| PB AC-2 | Hard business-rule filtering occurs before AI ranking.                                                                                           |
| PB AC-3 | Only permitted preference/product behavior signals are used.                                                                                     |
| PB AC-4 | Sensitive prohibited data is not used for ranking.                                                                                               |
| PB AC-5 | Cold start uses explicit/non-sensitive signals rather than invented preferences.                                                                 |
| PB AC-6 | Recommendation is advisory and cannot reserve, book, change price, or change Trip state.                                                         |
| PB AC-7 | Booking a recommended Trip revalidates authoritative rules.                                                                                      |
| PB AC-8 | Model/ranking version and generation metadata are retained.                                                                                      |
| PB AC-9 | Recommendations are distinguishable from normal search results.                                                                                  |

## 2. Scope

### In Scope

- Eligible candidate filtering.
- Ranking.
- Cold start.
- Recommendation metadata.
- Optional non-sensitive explanation.

### Out of Scope

- Auto-booking.
- Auto-reserving capacity.
- Price/state modification.

## 3. Actors & Authorization

Primary actor:

- Camper.

## 4. Preconditions & Dependencies

Eligible published Trip data exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-288 | The candidate set for Personalized Trip Recommendation may include only Trips that are published, before their booking deadline, not yet started or ended, have remaining capacity, use an eligible Route, and are not blocked by a Weather Risk hard rule. |
| BR-289 | Hard business-rule filtering must run before AI ranking. AI must not add an ineligible Trip to the candidate set or override publish, deadline, capacity, weather, or access-control state.                                                                 |
| BR-290 | Recommendations may use only explicit preferences and permitted product behavior such as search/view/Booking history, trip type, difficulty, and location/price preferences. Only data necessary for the recommendation purpose may be processed.           |
| BR-291 | Recommendations must not use medical profiles, SOS/emergency history, raw exact GPS trails, authentication secrets, or payment credentials as ranking signals.                                                                                              |
| BR-292 | When behavior history is insufficient, the system must use a cold-start strategy based on explicit preferences and appropriate non-sensitive/aggregate signals rather than fabricating a preference profile.                                                |
| BR-293 | Recommendation output is advisory ranking only. It must not reserve a seat, create a Booking, change price, or change Trip state automatically.                                                                                                             |
| BR-294 | When a Camper opens or books a recommended Trip, the backend must still revalidate all authoritative Business Rules at the time of the operation. A prior recommendation does not guarantee current availability.                                           |
| BR-295 | The system must store the model/ranking version, generated_at, and sufficient metadata to evaluate/debug recommendations without retaining unnecessary sensitive prompts or data.                                                                           |
| BR-296 | Camper-facing recommendations must be distinguishable from ordinary search results. The system may provide an explanation for the recommendation only when doing so does not expose sensitive data.                                                         |

## 6. State & Lifecycle

Eligible candidate set
→ ranking
→ recommendation generated
→ Camper views
→ optional Trip open/Booking
→ authoritative revalidation.

## 7. Business Flow

1. Build eligible Trip candidate set.
2. Remove Trips failing hard rules.
3. Gather permitted signals.
4. Apply cold-start strategy if needed.
5. Rank candidates.
6. Store model/version/generated metadata.
7. Display as recommendations.
8. On Trip open/Booking, revalidate authoritative state.

## 8. Data & Invariants

AI cannot restore a Trip removed by hard-rule filtering.

Recommendation does not guarantee future availability.

Sensitive prohibited signals must not enter ranking.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior         |
| ---------------------------- | ------------------------- |
| Trip full                    | Excluded                  |
| Weather hard-block           | Excluded                  |
| No history                   | Cold-start strategy       |
| Medical profile exists       | Not used                  |
| Recommendation becomes stale | Revalidate before Booking |
| AI ranks ineligible Trip     | Must not enter result     |

## 11. Acceptance & Test Matrix

| Source     | Scenario                      | Expected Result           | Test Type  |
| ---------- | ----------------------------- | ------------------------- | ---------- |
| BR-288/289 | Ineligible Trip               | Excluded before ranking   | Safety     |
| BR-291     | Sensitive signal              | Not used                  | Privacy    |
| BR-292     | New Camper                    | Cold-start works          | Functional |
| BR-293     | Recommendation generated      | No Booking/state mutation | Integrity  |
| BR-294     | Recommended Trip booked later | Revalidated               | E2E        |
| BR-295     | Result generated              | Version metadata retained | Audit      |

## 12. Open Decisions

Ranking algorithm/model is Technical Design; no specific algorithm is mandated here.

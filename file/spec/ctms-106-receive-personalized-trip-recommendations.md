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
| PB AC-4 | Health-profile analysis requires the Camper's persisted sharing consent. Health data stays on the server and is not sent to the external AI ranker. |
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
| BR-290 | Recommendations use explicit preferences and permitted product behavior such as Booking history, trip type, difficulty and location/price preferences, plus consented health-profile analysis under BR-291. Process only information necessary for the recommendation purpose. |
| BR-291 | Before generating or explaining suggestions, require the requesting Camper's existing health profile with sharing consent enabled. Read current fitness from that profile for server-side suitability ranking and current profile entries for explanation. Never send health details to the external AI ranker or use SOS/emergency history, raw GPS trails, authentication secrets, or payment credentials. |
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

Health data must remain server-side and may be used only while sharing consent is enabled. Recheck consent before returning a generation after external work.

## 9. API / Integration Contract

- `GET /trip-recommendations`: check current stored health-sharing consent before ranking. Return `needs_health_consent` with no items when the profile is missing or sharing is off.
- `POST /trip-recommendations/regenerate`: Camper-requested regeneration from the latest saved profile, preferences and eligible Trips. Bypass the stored AI order, retain the same consent and eligibility checks.
- `GET /trip-recommendations/trips/:tripId/explanation`: requires current consent; otherwise return `403` with `HEALTH_CONSENT_REQUIRED`.
- Web health-profile reads, versioned updates and consent actions use the real `/camper/health-profile` API. No mock fallback or browser-only writes.
- Rules version `trip-recommendation-rules-v5`; profile-only generations record the `health_profile` signal. Migration `1797400000000-AllowHealthProfileRecommendationSignal` extends the metadata constraint without rewriting history.

### Health-first suitability

- Store optional `activityProfile` in the existing health profile: `comfortableDistanceKm` and `comfortableWalkingMinutes` per day, optional `activityNotes` (up to 1,200 characters), and a server-generated `confirmedAt`. Weekly activity frequency is no longer collected or required for assessment.
- Saving the health profile records the submitted activity facts and their save time automatically. There is no separate confirmation checkbox, displayed confirmation date, or confirmation requirement in recommendation assessment. The legacy `confirmCurrent` input remains accepted but has no effect. Older clients omitting the activity object preserve stored values; missing walking limits remain unknown.
- Compare declared distance/time with stored Route length/duration. Use daily figures only for day Trips; multi-day Route totals cannot establish per-day suitability.
- Stable priority: `suitable` → `needs_review` → `insufficient_data`. Apply before AI shortlisting and again after ranking; preferences and AI only order Trips within the same tier.
- `suitable` means the available activity requirements match the saved declared facts, not medical clearance. Missing activity facts or required Route measurements prevent this status. Explicit zero capacity differs from an unknown value.
- Medical conditions and activity notes require clarification when the system has no corresponding verified support data. Do not infer contraindications or promises of support from condition names or free text. Allergy and dietary fields are no longer shown or considered by recommendations.
- Return `healthBasis` with the actual profile facts used and `healthAssessment` per Trip and explanation: status, comparison of provided/required values, summary, missing information and confirmation date. Re-read profile and availability on manual regeneration.
- Migration `1797500000000-AddHealthActivityProfile` adds nullable storage without inventing data for existing profiles. Health fields and comparisons are never included in the external AI request.
- Migration `1797600000000-SimplifyHealthActivityProfile` preserves both legacy notes in `activityNotes`, removes weekly frequency, and retains declared walking limits and confirmation dates. Legacy note inputs remain accepted for older clients and are merged when saved.

## 10. Error & Edge Cases

| Case                         | Expected Behavior         |
| ---------------------------- | ------------------------- |
| Trip full                    | Excluded                  |
| Weather hard-block           | Excluded                  |
| No history                   | Cold-start strategy       |
| Health profile missing or sharing disabled | Return `needs_health_consent`, no suggestions or generation record; direct Camper to the health profile. |
| Sharing revoked after a generation | Block generation and explanation, including cached results and manual regeneration. |
| Profile shared, no preferences/history | Generate from current fitness on the server without calling the external AI ranker. |
| Manual regeneration | Re-read the current stored profile and consent; bypass cached AI order, then revalidate availability. |
| Recommendation becomes stale | Revalidate before Booking |
| AI ranks ineligible Trip     | Must not enter result     |

## 11. Acceptance & Test Matrix

| Source     | Scenario                      | Expected Result           | Test Type  |
| ---------- | ----------------------------- | ------------------------- | ---------- |
| BR-288/289 | Ineligible Trip               | Excluded before ranking   | Safety     |
| BR-291     | Health sharing disabled       | No generation or explanation; no health data sent externally | Privacy |
| BR-292     | New Camper                    | Cold-start works          | Functional |
| BR-293     | Recommendation generated      | No Booking/state mutation | Integrity  |
| BR-294     | Recommended Trip booked later | Revalidated               | E2E        |
| BR-295     | Result generated              | Version metadata retained | Audit      |

## 12. Open Decisions

Ranking algorithm/model is Technical Design; no specific algorithm is mandated here.

### Structured preference matching (rules v5 / prompt v2)

- Hosts explicitly declare Trip activities; Campers explicitly select preferred activities. Missing activity data never implies a match. Existing rows default to an empty list, without inferring tags from titles, descriptions or personal free text.
- Base ranking is 80% existing type/difficulty/region/price score, 15% fraction of selected activities offered, and 5% declared experience fit. Health tiers remain authoritative. Declared years are advisory and never certify ability.
- Activity fields omitted by older clients preserve saved values on update; an explicit empty array clears them. Both Trip drafts and published response types carry activities.
- Booking signals include linked companions and deduplicate Trips. They describe bookings, never prove that a traveller completed or mastered a Route. Free-text biography and experience are not parsed or sent to AI.
- Reuse AI ranking only for unchanged structured inputs and candidate facts; refresh forecasts before weather filtering with bounded concurrency. Show health status and validated reasons on suggestion cards in web and mobile.

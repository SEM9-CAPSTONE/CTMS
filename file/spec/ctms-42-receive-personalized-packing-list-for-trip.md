# CTMS-042 — Receive Personalized Packing List for Trip

## 1. Overview

Story: CTMS-042

Epic: EPIC 6. Equipment and Logistics

Use Case: Receive Personalized Packing List for Trip

Priority: Should Have

Goal: Generate a traceable packing list from authoritative Trip, weather, difficulty, duration, permitted member context and already-rented equipment.

Acceptance Criteria:

| Source  | Criterion                                                                 |
| ------- | ------------------------------------------------------------------------- |
| PB AC-1 | Packing list uses Trip/Booking context, weather, duration and difficulty. |
| PB AC-2 | Equipment already rented is considered.                                   |
| PB AC-3 | Items distinguish mandatory and recommended categories.                   |
| PB AC-4 | Medical/personal information is used only when authorized by consent.     |
| PB AC-5 | Generation sources are traceable.                                         |
| PB AC-6 | AI-generated recommendations cannot override deterministic safety rules.  |

## 2. Scope

### In Scope

- Generate packing list.
- Weather context.
- Trip duration.
- Difficulty.
- Rented equipment.
- Permitted participant context.
- Mandatory/recommended classification.
- Generation traceability.

### Out of Scope

- Equipment reservation.
- Weather Risk calculation.
- Medical profile management.
- AI as authoritative safety-policy engine.

## 3. Actors & Authorization

- Camper.
- System.
- Recommendation/AI component where used.

Medical/member context requires applicable authorization/consent.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-029.
- CTMS-010.
- CTMS-016.

Booking and Trip context must exist.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-137     | A packing list must be generated from Trip/Booking context, weather, duration, difficulty, permitted member context, and rented equipment. The source context used for generation must be stored in generated_from for traceability.                          |
| BR-138     | A packing list must distinguish required from recommended items using the defined category/metadata. Medical data must not be included unless consent is present.                                                                                             |
| BR-219     | A personalized packing list must be generated from the current Trip, weather data, difficulty, duration, and rented equipment. Required and recommended items must be clearly separated, and the list must be regenerated when material source inputs change. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                         |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                  |

## 6. State & Lifecycle

Trip/Booking context
→ packing-list generation
→ generated packing list.

Regeneration may produce a new list when authoritative inputs change.

## 7. Business Flow

1. Camper requests packing list.
2. Backend loads Trip/Booking.
3. Load duration/difficulty.
4. Load applicable weather/risk context.
5. Load rented equipment.
6. Load only permitted member context.
7. Generate candidate items.
8. Classify mandatory/recommended.
9. Apply deterministic safety constraints.
10. Store generation-source metadata.
11. Return packing list.

## 8. Data & Invariants

- Generated list is traceable to inputs.
- Medical data requires consent.
- Already-rented equipment is considered.
- Mandatory/recommended are distinguishable.
- AI cannot downgrade deterministic mandatory safety requirement.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                        |
| --------------------------- | -------------------------------------------------------- |
| Weather unavailable         | Represent unavailable context; do not fabricate weather. |
| No rented equipment         | Generate using remaining valid inputs.                   |
| Medical consent absent      | Exclude medical information.                             |
| AI suggests unsafe omission | Deterministic rule wins.                                 |
| Inputs change               | Regeneration may produce new traceable version.          |

## 11. Acceptance & Test Matrix

| Source  | Scenario                      | Expected Result                       | Test Type   |
| ------- | ----------------------------- | ------------------------------------- | ----------- |
| BR-137  | Valid Trip context            | Packing list generated                | Integration |
| BR-137  | Rented equipment exists       | Considered in list                    | Integration |
| BR-138  | Generated items               | Mandatory/recommended distinguishable | UI          |
| BR-138  | No medical consent            | Medical context excluded              | Security    |
| BR-219  | AI conflicts with safety rule | Safety rule wins                      | AI Safety   |
| PB AC-5 | Inspect generated list        | Source traceable                      | Audit       |

## 12. Open Decisions

Exact packing-list taxonomy/content library belongs to the approved packing/survival knowledge contract.

**Resolved (2026-10-14, confirmed by the team leader):** BR-137 requires the generation source to be stored in `generated_from`. The first implementation computed the list on demand and returned its context but stored nothing; this is corrected below.

## 13. Implementation Record — generated_from (BR-137)

- **New table `packing_list_generations`** (migration `1787230000000-CreatePackingListGenerations`): `id`, `booking_id` (FK to `bookings`, `ON DELETE CASCADE`), `generated_from` (jsonb), `input_fingerprint` (sha256 of `generated_from`), `created_at`; unique on (`booking_id`, `input_fingerprint`).
- **`generated_from` contents:** `rulesVersion` (`packing-list-rules-v1`, bumped whenever the deterministic rules change), `tripId`, `durationNights`, `tripType`, `difficulty`, `memberCount`, the Weather Risk assessment used (`id`, `riskLevel`), rented equipment (`equipmentCatalogItemId`, `quantity`, sorted), and `healthProfile: { considered, updatedAt }`.
- **No health data is stored** (BR-186, BR-192, BR-138): only whether consented health data was used and the profile's `updatedAt` version. Allergy, condition and dietary content never leaves the health profile.
- **Regeneration (BR-219):** every `GET /bookings/:bookingId/packing-list` builds `generated_from` from the current inputs. Unchanged inputs reuse the existing generation; changed inputs (new weather assessment, rented equipment, health consent, rules version…) create a new traceable row. The write is one `INSERT … ON CONFLICT DO NOTHING` statement, so concurrent requests with the same inputs store one row.
- **API:** the response adds `generationId` and `generatedAt`. Existing fields and the web UI are unchanged.

## 14. Test Evidence — generated_from (BR-137)

- Unit (`bookings.packing-list.service.spec.ts`): stored inputs and returned generation id; same inputs give the same fingerprint, changed weather gives a new one; health content never stored, `considered` only with consent.
- Integration (real Postgres, `bookings.packing-list.integration-spec.ts`): repeated calls store one generation; stored `generated_from` matches the real Trip, Route and weather assessment; renting equipment creates a second generation listing it; six concurrent requests store one row with one id; health content (allergy, dietary note) absent from the stored JSON.

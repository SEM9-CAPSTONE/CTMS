# CTMS-109 — View AI Demand Insight and Trip Suggestions

## 1. Overview

Story: CTMS-109

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: View AI Demand Insight and Trip Suggestions

Priority: Should Have

Goal: Provide Host with privacy-preserving aggregate demand insights and advisory Trip suggestions without exposing Camper-level behavior or automatically changing Trip inventory.

Backlog story: As a Host, I want to view AI demand insights and Trip suggestions so I can understand aggregate market demand.

Acceptance Criteria:

| Source   | Criterion                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| PB AC-1  | Insights use aggregate/anonymized data.                                                                        |
| PB AC-2  | Permitted aggregate demand signals may be used.                                                                |
| PB AC-3  | Sensitive prohibited signals are not used/exposed.                                                             |
| PB AC-4  | Minimum configured cohort threshold is enforced.                                                               |
| PB AC-5  | Insufficient data returns `insufficient_data` instead of individual inference.                                 |
| PB AC-6  | Host receives only appropriate aggregate market insight.                                                       |
| PB AC-7  | Suggestion identifies supported area/category/Trip type, demand indication, reason/data period when supported. |
| PB AC-8  | Suggestion cannot auto-create/publish/change Trip price.                                                       |
| PB AC-9  | Trip created from suggestion still follows normal Trip rules.                                                  |
| PB AC-10 | Insight stores data window/version/generated time and stale state is identifiable.                             |

## 2. Scope

### In Scope

- Aggregate demand.
- Privacy threshold.
- AI Trip suggestion.
- Freshness/version context.

### Out of Scope

- Camper-level profiling for Host.
- Automatic Trip creation/publishing/pricing.

## 3. Actors & Authorization

Primary actor:

- Host.

## 4. Preconditions & Dependencies

Sufficient permitted aggregate demand data exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-309 | Host Demand Insight may be generated only from aggregate/anonymized data. A Host must not gain access to row-level Camper profiles or behavior through insight features.                                   |
| BR-310 | Permitted signals include legitimately collected aggregate search/view/Booking demand, destination or area interest, trip type, difficulty, price band, and season/time.                                   |
| BR-311 | Demand Insight must not use or expose medical information, SOS/emergency history, raw exact GPS history, private AI-survival questions, or payment credentials.                                            |
| BR-312 | The system must apply a configured minimum cohort/aggregation threshold before displaying an insight. If the dataset is too small, it must return insufficient_data rather than infer individual behavior. |
| BR-313 | A Host may receive only appropriate market-level or aggregate demand insight. Private commercial metrics of another specific Host must not be exposed without authorization.                               |
| BR-314 | An AI suggestion for a Host must include, at minimum, the suggested area/category/trip type, an indication of demand, and the supporting reason/data period when the data supports those fields.           |
| BR-315 | AI Demand Insight is advisory only. It must not automatically create or publish a Trip or change Trip pricing.                                                                                             |
| BR-316 | A Trip created by a Host from a demand suggestion must still pass the normal Create Trip validation, approval, capacity, Route, and Weather Risk rules.                                                    |
| BR-317 | Insight generation must record the data window/version and generated time so the Host can understand data freshness. Stale insights must be identifiable.                                                  |

## 6. State & Lifecycle

Aggregate data
→ privacy/cohort gate
→ insight generation
→ suggestion
→ Host view
→ optional normal Create Trip flow.

## 7. Business Flow

1. Aggregate permitted demand signals.
2. Apply anonymization/cohort threshold.
3. If insufficient, return `insufficient_data`.
4. Generate demand insight.
5. Generate advisory suggestion where supported.
6. Store data window/version/generated time.
7. Display freshness.
8. If Host acts, enter normal Trip creation flow.

## 8. Data & Invariants

No row-level Camper profile is exposed.

AI suggestion is advisory only.

Stale insight must be identifiable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior   |
| ------------------------ | ------------------- |
| Cohort too small         | `insufficient_data` |
| Medical/SOS signal       | Excluded            |
| Stale insight            | Mark stale          |
| Host accepts suggestion  | Normal Trip flow    |
| AI attempts auto-publish | Prohibited          |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result       | Test Type |
| ------ | -------------------- | --------------------- | --------- |
| BR-309 | Insight              | Aggregate only        | Privacy   |
| BR-312 | Small cohort         | insufficient_data     | Privacy   |
| BR-311 | Sensitive signal     | Excluded              | Security  |
| BR-315 | Suggestion generated | No automatic mutation | Integrity |
| BR-317 | Old insight          | Stale identifiable    | UI        |

## 12. Open Decisions

Minimum cohort value is configuration-driven; this spec does not invent a numeric threshold.

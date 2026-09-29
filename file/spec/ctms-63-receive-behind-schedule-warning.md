# CTMS-063 — Receive Behind-Schedule Warning

## 1. Overview

Story: CTMS-063

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: Receive Behind-Schedule Warning

Priority: Should Have

Goal: Detect meaningful delay against available planned/estimated Trip progress and provide actionable safety guidance.

Backlog story: As a Camper, I want to know when I am behind schedule so I can take the appropriate safety action.

Acceptance Criteria:

| Source  | Criterion                                                                  |
| ------- | -------------------------------------------------------------------------- |
| PB AC-1 | System compares planned/estimated progress with actual available progress. |
| PB AC-2 | When user is behind schedule, system issues an applicable warning.         |
| PB AC-3 | Warning provides nearest safe checkpoint.                                  |
| PB AC-4 | Guidance states the action required by operational policy.                 |

## 2. Scope

### In Scope

- Planned/estimated progress.
- Actual progress.
- Behind-schedule evaluation.
- Safe checkpoint.
- Operational guidance.

### Out of Scope

- OFF_ROUTE detection.
- Route modification.
- Inventing a new Trip schedule.

## 3. Actors & Authorization

- Camper.
- Safety subsystem.

## 4. Preconditions & Dependencies

Applicable Trip itinerary/progress data is available.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-241     | The system must compare planned/estimated progress with actual progress using available data. When the user is behind schedule, the system must provide the nearest safe Checkpoint and guidance that clearly states the action required under operational policy. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                              |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                       |

## 6. State & Lifecycle

On schedule
→ progress comparison indicates applicable delay
→ behind-schedule warning.

Recovery behavior follows the authoritative operational policy.

## 7. Business Flow

1. Load planned/estimated progress.
2. Read actual progress.
3. Compare according to approved calculation.
4. Determine whether behind-schedule condition exists.
5. Find nearest applicable safe checkpoint.
6. Resolve operational action from policy.
7. Warn Camper.
8. Preserve event/context where required.

## 8. Data & Invariants

- Actual progress must come from available authoritative/local operational data.
- Warning must not fabricate a safe checkpoint.
- Action guidance comes from policy.
- LLM must not invent or override hard safety policy.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                              | Expected Behavior                                        |
| --------------------------------- | -------------------------------------------------------- |
| Progress insufficient to evaluate | Do not fabricate behind-schedule result                  |
| User behind schedule              | Warning shown                                            |
| No safe checkpoint resolvable     | Do not invent one; apply approved fallback policy        |
| Offline                           | Use locally available authoritative data where supported |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result          | Test Type |
| ------ | -------------------- | ------------------------ | --------- |
| BR-241 | Progress on schedule | No false warning         | Detection |
| BR-241 | Progress behind      | Warning                  | Detection |
| BR-241 | Warning generated    | Safe checkpoint included | Safety    |
| BR-241 | Warning generated    | Policy action included   | Safety    |

## 12. Open Decisions

The retrieved source does not define a numeric behind-schedule threshold in BR-241. Do not invent one; the threshold/calculation must come from authoritative PB/configuration if separately defined.

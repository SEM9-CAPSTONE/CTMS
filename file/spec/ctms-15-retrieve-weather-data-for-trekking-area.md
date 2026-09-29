# CTMS-015 — Retrieve Weather Data for Trekking Area

## 1. Overview

Story: CTMS-015

Epic: EPIC 3. Weather Risk Assessment

Use Case: Retrieve Weather Data for Trekking Area

Priority: Must Have

Goal: Retrieve and persist traceable weather observations used by the deterministic Weather Risk workflow.

Backlog story:
As the System, I want to retrieve weather data for a trekking area so risk can be assessed using current weather inputs.

Acceptance Criteria:

| Source  | Criterion                                                                        |
| ------- | -------------------------------------------------------------------------------- |
| PB AC-1 | System retrieves weather data for the applicable trekking area.                  |
| PB AC-2 | Weather input is stored with source/location/time context needed for assessment. |
| PB AC-3 | Provider timeout/incomplete data is not treated as verified success.             |
| PB AC-4 | Retry behavior is bounded and does not create duplicate snapshots.               |

## 2. Scope

### In Scope

- Retrieve external weather data.
- Create weather snapshot.
- Preserve source and location context.
- Store supported weather factors.
- Handle provider timeout/incomplete data.
- Bounded retry/backoff.

### Out of Scope

- Calculating risk score; CTMS-016.
- LLM advice; CTMS-019.
- Configuring weather rules; CTMS-020.

## 3. Actors & Authorization

Primary actor: System.

External weather provider supplies input but is not authoritative for CTMS business risk decisions.

## 4. Preconditions & Dependencies

Dependency: CTMS-010.

A valid trekking-area/Route location must be resolvable.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-039 | weather_snapshots must store the provider values actually received for source, location, rainfall, wind_speed, temperature, humidity, visibility, uv_index, storm_alert, fetched_at, and forecast_at. Missing values must not be fabricated or auto-filled. |
| BR-040 | If the weather provider times out, fails, or omits a critical field, the system must log the failure and mark the data as insufficient or stale according to policy. It must not generate an assessment as though the data were complete.                   |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.      |
| BR-197 | When an external service times out or returns incomplete data, the system must record the failure, must not assume success, and must not fabricate unverifiable data.                                                                                       |
| BR-198 | Retries to external services must be bounded and use backoff. Retrying must not create duplicate records or transactions.                                                                                                                                   |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                       |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                |

## 6. State & Lifecycle

Weather retrieval requested
→ provider success
→ authoritative Weather Snapshot stored.

Provider failure/incomplete response
→ failed/degraded retrieval
→ no fabricated successful snapshot.

## 7. Business Flow

1. System resolves trekking-area location.
2. System requests weather data.
3. Provider responds.
4. Backend validates response completeness and source/time context.
5. Valid data is stored as Weather Snapshot.
6. Failed/timeout response is recorded.
7. Retry occurs only under bounded retry policy.
8. Valid snapshot becomes input to CTMS-016.

## 8. Data & Invariants

Source-supported weather factors:

- rainfall
- wind speed
- temperature
- humidity
- visibility
- UV index
- storm alert
- source
- location

Provider data and CTMS risk outcome remain separate concepts.

## 9. API / Integration Contract

TBD — Technical Design.

Weather provider is not selected by this Business Spec.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                                                 |
| --------------------------- | --------------------------------------------------------------------------------- |
| Provider timeout            | Record failure; do not assume success.                                            |
| Incomplete response         | Do not create unverifiable authoritative snapshot.                                |
| Provider retry              | Apply bounded retry/backoff.                                                      |
| Duplicate provider response | Do not duplicate authoritative snapshot.                                          |
| Stale weather data          | Handle according to approved stale-data policy; do not silently treat as current. |

## 11. Acceptance & Test Matrix

| Source | Scenario                   | Expected Result                  | Test Type   |
| ------ | -------------------------- | -------------------------------- | ----------- |
| BR-039 | Complete provider response | Snapshot stored.                 | Integration |
| BR-197 | Timeout                    | No false success.                | Integration |
| BR-197 | Incomplete data            | Rejected/degraded.               | Boundary    |
| BR-198 | Provider repeatedly fails  | Retry stops at configured limit. | Integration |
| BR-198 | Duplicate retry response   | No duplicate snapshot.           | Idempotency |

## 12. Open Decisions

Exact provider, freshness duration and provider-specific response mapping are not defined by these rules and remain Technical Design/configuration decisions unless PB/BR defines them elsewhere.

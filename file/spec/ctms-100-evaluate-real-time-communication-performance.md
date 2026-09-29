# CTMS-100 — Evaluate Real-Time Communication Performance

## 1. Overview

Story: CTMS-100

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Evaluate Real-Time Communication Performance

Priority: Must Have

Goal: Evaluate real-time SOS delivery, normal real-time event latency, and missed-event recovery using the approved V3 performance gates.

Backlog story: As the System, I want to evaluate real-time communication performance so critical and normal real-time delivery can be verified against release requirements.

Acceptance Criteria:

| Source  | Criterion                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | SOS delivery latency is evaluated under stable connection conditions.                                                             |
| PB AC-2 | SOS delivery P95 must be <5 seconds.                                                                                              |
| PB AC-3 | Normal real-time event latency P95 must be ≤2 seconds.                                                                            |
| PB AC-4 | Normal real-time event latency P99 must be ≤5 seconds.                                                                            |
| PB AC-5 | Missed-event recovery after reconnection must equal 100%.                                                                         |
| PB AC-6 | Average latency and concurrency observations are reported.                                                                        |
| PB AC-7 | Average latency/concurrency observations are not standalone release gates unless separately defined.                              |
| PB AC-8 | Latency evidence preserves applicable sent/received/acknowledged timing without storing sensitive payload merely for measurement. |

## 2. Scope

### In Scope

- SOS P95 delivery latency.
- Normal realtime P95/P99 latency.
- Missed-event recovery.
- Average latency observation.
- Concurrency observation.
- Performance evidence.

### Out of Scope

- WebSocket implementation — CTMS-078.
- Reconnect implementation — CTMS-082.
- Creating additional unapproved performance gates.

## 3. Actors & Authorization

Actor:

- System/evaluation process.
- Authorized evaluator where applicable.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-078.
- CTMS-079.
- CTMS-082.

Performance test conditions and applicable event set are defined.

Stable connection conditions must be established for the SOS delivery gate.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-281 | Real-time evaluation release gates are: SOS delivery P95 <5 seconds under stable connectivity, normal real-time event latency P95 <=2 seconds and P99 <=5 seconds, and 100% missed-event recovery after reconnect. Average latency and concurrency observations must be reported but are not separate release gates.                                                   |
| BR-265 | WebSocket latency measurement must store sent_at, received_at, acknowledged_at, latency_ms, and event_type and must support aggregate average/P95/P99 reporting. Sensitive payloads must not be retained solely for latency measurement.                                                                                                                               |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release. |

## 6. State & Lifecycle

Performance test configured
→ events emitted
→ timestamps captured
→ disconnect/reconnect scenarios executed
→ metrics aggregated
→ release gates evaluated
→ Pass/Fail report.

## 7. Business Flow

1. Prepare versioned test scenario.
2. Establish applicable stable WebSocket condition.
3. Emit SOS test events.
4. Record server/client timing.
5. Emit normal realtime events.
6. Calculate P95/P99 latency.
7. Execute disconnect/reconnect scenario.
8. Determine eligible missed events.
9. Measure recovery percentage.
10. Record average latency/concurrency observations.
11. Compare gated metrics with approved thresholds.
12. Persist evaluation report.

## 8. Data & Invariants

Measurement data includes applicable:

- sent_at;
- received_at;
- acknowledged_at;
- latency_ms;
- event_type.

Release gates:

- SOS delivery P95 `< 5 seconds`;
- normal event P95 `≤ 2 seconds`;
- normal event P99 `≤ 5 seconds`;
- missed-event recovery `= 100%`.

Average latency and concurrency are observational unless another approved rule defines a gate.

Sensitive payload must not be retained solely to measure latency.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                            | Expected Behavior                                 |
| ----------------------------------------------- | ------------------------------------------------- |
| SOS P95 =4.9s                                   | Pass                                              |
| SOS P95 =5.0s                                   | Fail because gate is strictly `<5s`               |
| Normal P95 =2s                                  | Pass                                              |
| Normal P95 >2s                                  | Fail                                              |
| Normal P99 =5s                                  | Pass                                              |
| Normal P99 >5s                                  | Fail                                              |
| Missed recovery =100%                           | Pass                                              |
| One eligible missed event unrecovered           | Recovery gate fails                               |
| High average latency but gated percentiles pass | Report observation; do not invent additional gate |
| Sensitive event payload                         | Do not store merely for performance measurement   |

## 11. Acceptance & Test Matrix

| Source | Scenario          | Expected Result                           | Test Type     |
| ------ | ----------------- | ----------------------------------------- | ------------- |
| BR-281 | SOS P95 <5s       | Pass                                      | Performance   |
| BR-281 | SOS P95 ≥5s       | Fail                                      | Performance   |
| BR-281 | Normal P95 ≤2s    | Pass                                      | Performance   |
| BR-281 | Normal P99 ≤5s    | Pass                                      | Performance   |
| BR-281 | Recovery =100%    | Pass                                      | Reliability   |
| BR-281 | Recovery <100%    | Fail                                      | Reliability   |
| BR-265 | Latency captured  | Timing evidence retained                  | Observability |
| BR-282 | Evaluation report | Versions/metrics/thresholds/result stored | Traceability  |

## 12. Open Decisions

The controlled definition of a "stable connection" must be specified by the evaluation/Technical Design while preserving the approved `<5 seconds` SOS P95 gate.

# CTMS-100 — Evaluate Real-Time Communication Performance

## 1. Overview

Story: CTMS-100
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Evaluate Real-Time Communication Performance
Priority: Must Have

Goal:
Allow Admin to evaluate whether SOS and normal realtime communication meet approved V3 release gates.

Acceptance summary:
PASS requires SOS delivery P95 < 5 seconds on a stable connection, normal realtime event latency P95 <= 2 seconds, normal realtime event latency P99 <= 5 seconds, and reconnect missed-event recovery = 100%. Average latency and concurrency observations are reported but are not separate release gates.

## 2. Scope

### In Scope

- Release-gate evaluation for SOS delivery, normal realtime delivery, and reconnect recovery.
- Reporting of average latency and concurrency observations.

### Out of Scope

- Implementing WebSocket, SOS persistence, or notification delivery behavior.

## 3. Actors & Authorization

- Admin: reviews realtime evaluation results.
- System: runs realtime communication evaluation scenarios.

Only Admin or an authorized evaluation job may run or view reports.

## 4. Preconditions & Dependencies

- Evaluation dataset defines SOS delivery events, normal realtime events, reconnect scenarios, and expected missed-event recovery.
- Stable-connection conditions for SOS P95 measurement are documented.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-281 | Realtime evaluation gates are SOS delivery P95 < 5 seconds on stable connection, normal realtime event latency P95 <= 2 seconds and P99 <= 5 seconds, and missed-event recovery after reconnect = 100%. Average latency and concurrency observations must be reported but are not separate gates. |
| BR-282 | Evaluation reports must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not independently fail release. |
| BR-437 | Operational monitoring must provide metrics/logs sufficient to investigate sample gaps, sync delay, duplicate rejection, invalid GPS payloads, and safety event delivery. Technical telemetry does not replace business audit records. |
| BR-470 | Realtime Communication PASS requires SOS delivery P95 < 5s, normal realtime delivery P95 <= 2s, P99 <= 5s, and reconnect missed-event recovery = 100%. All release-gate metrics must pass. |
| BR-188 | Latency and event ordering measurements must use authoritative time rules. |
| BR-212 | Rule, enum, state transition, or API contract changes must update spec, tests, and data documentation before Done. |
| BR-213 | Evaluation rules must have valid-path and violation-path test coverage. |
| BR-265 | Realtime delivery behavior must provide observable delivery metrics needed for evaluation. |

## 6. State & Lifecycle

```text
Realtime evaluation
    ├── all SOS, normal realtime, and reconnect gates pass -> PASS
    └── any release gate fails -> FAIL
```

## 7. Business Flow

1. Admin or authorized job selects the realtime evaluation dataset.
2. System measures SOS delivery latency under stable connection conditions.
3. System measures normal realtime delivery P95 and P99 latency.
4. System tests reconnect recovery and counts missed events after reconnect.
5. System reports average latency and concurrency observations separately from release gates.
6. PASS is recorded only when all release-gate metrics pass.

## 8. Data & Invariants

- SOS delivery P95 must be strictly less than 5 seconds.
- Normal realtime P95 passes at <= 2 seconds; P99 passes at <= 5 seconds.
- Reconnect missed-event recovery must equal 100%.
- Average latency and concurrency observations do not override failed release gates.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| SOS delivery P95 equals 5 seconds | Evaluation FAILS because SOS threshold is strictly < 5s. |
| Normal realtime P95 equals 2 seconds | P95 gate passes. |
| Normal realtime P99 exceeds 5 seconds | Evaluation FAILS. |
| Reconnect recovery is 99.9% | Evaluation FAILS. |
| Dataset/version is missing | Report is incomplete and cannot be accepted as release evidence. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| BR-281, BR-470 | SOS P95 = 4.99s, normal P95 = 2s, normal P99 = 5s, reconnect recovery = 100% | Evaluation PASS if all metrics meet thresholds | Boundary |
| BR-470 | SOS P95 = 5s | Evaluation FAILS | Boundary |
| BR-470 | Reconnect recovery = 99.9% | Evaluation FAILS | Release Gate |
| BR-437 | Delivery anomaly occurs during evaluation | Monitoring data is sufficient to investigate without replacing business audit records | Observability |
| BR-282 | Evaluation report is stored | Dataset/version, metric values, thresholds, rule/config version, and pass/fail conclusion are present | Report Validation |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.

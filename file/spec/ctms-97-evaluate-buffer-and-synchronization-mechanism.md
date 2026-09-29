# CTMS-097 — Evaluate Buffer and Synchronization Mechanism

## 1. Overview

Story: CTMS-097

Epic: EPIC 17. Reports and Evaluation Metrics

Use Case: Evaluate Buffer and Synchronization Mechanism

Priority: Must Have

Goal: Verify that offline buffering and reconnection synchronization preserve valid data and safety events without authoritative duplicates under partial failure and retry.

Backlog story: As the System, I want to evaluate buffering and synchronization so offline operational data can be proven reliable after reconnection.

Acceptance Criteria:

| Source  | Criterion                                                                |
| ------- | ------------------------------------------------------------------------ |
| PB AC-1 | Evaluation applies approved offline-buffer and synchronization rules.    |
| PB AC-2 | Partial-failure batches are evaluated using V3 partial-acceptance rules. |
| PB AC-3 | 100% of valid records in a partial-failure batch must be accepted.       |
| PB AC-4 | Zero confirmed safety events may be lost.                                |
| PB AC-5 | Zero authoritative duplicate records may exist after retry/resend.       |
| PB AC-6 | Delay, retry, and error metrics are reported.                            |
| PB AC-7 | Evaluation evidence stores version/threshold/result context.             |

## 2. Scope

### In Scope

- Offline buffered records.
- Partial-failure batches.
- Valid-record acceptance.
- Safety-event preservation.
- Retry/resend idempotency.
- Delay/retry/error metrics.

### Out of Scope

- Runtime buffering implementation — CTMS-064.
- Runtime reliable sync implementation — CTMS-065.

## 3. Actors & Authorization

Actor:

- System/evaluation process.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-064.
- CTMS-065.

Evaluation includes offline, reconnect, partial-failure, retry and resend scenarios.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-278 | Buffer/synchronization evaluation must apply BR-436 and the V3 partial-acceptance rules BR-441 through BR-443. Release gates are: 100% of valid records in a partial-failure batch are accepted, zero confirmed safety events are lost, and zero authoritative duplicate records are created after retry/resend. Delay, retry, and error metrics must still be reported.                                                                                   |
| BR-436 | Offline-sync evaluation must test connectivity loss, app restart, retry, duplicate batches, out-of-order records, and partial failure. Release gates are: 100% of valid records are accepted even when the same batch contains invalid records, zero confirmed safety events are lost, and zero authoritative duplicates are created. The server must return per-record acknowledgements, and the client may retry only failed records that are retryable. |
| BR-441 | V3 sync batches must use partial acceptance. The server must validate each record independently; valid records must commit even when other records in the same batch are invalid. Invalid records must not roll back valid records that were already accepted.                                                                                                                                                                                             |
| BR-442 | The server must return a per-record acknowledgement for every record in a sync batch, including at minimum a stable record identifier, result = accepted/duplicate/failed, and failure_reason when failed. duplicate must be treated as terminal success when the same stable identifier was accepted previously.                                                                                                                                          |
| BR-443 | The client may mark a record as synced only when its acknowledgement result is accepted or duplicate. The client may retry only failed records whose errors are retryable. Non-retryable failures must remain in failed state with failure_reason available for display/audit. Retrying the same record or idempotency_key must not create a duplicate authoritative record.                                                                               |
| BR-282 | The V3 release gates defined in BR-276 through BR-281 and BR-434 through BR-438 are approved acceptance thresholds. Each evaluation report must store the dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Metrics explicitly designated as observational are reported only and must not independently fail the release.                                                                                     |

## 6. State & Lifecycle

Evaluation batch
→ offline buffer
→ reconnect/sync
→ partial acceptance/failure
→ retry/resend
→ authoritative-state verification
→ Pass/Fail.

## 7. Business Flow

1. Create versioned evaluation dataset.
2. Buffer records offline.
3. Include valid and invalid/failed records according to test scenario.
4. Restore connection.
5. Synchronize batch.
6. Record partial acceptance results.
7. Retry/resend applicable records.
8. Verify valid-record acceptance.
9. Verify confirmed safety-event preservation.
10. Verify authoritative duplicate count.
11. Report delay/retry/error metrics.
12. Determine Pass/Fail.

## 8. Data & Invariants

Release gates:

- valid records accepted = 100%;
- confirmed safety events lost = 0;
- authoritative duplicate records after retry/resend = 0.

Delay/retry/error metrics remain reportable observations unless another approved threshold exists.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                               | Expected Behavior                              |
| -------------------------------------------------- | ---------------------------------------------- |
| One valid record rejected in partial batch         | Fail                                           |
| One confirmed safety event lost                    | Fail                                           |
| Duplicate authoritative record after resend        | Fail                                           |
| Invalid record rejected but valid records accepted | Evaluate according to partial-acceptance rules |
| Retry count high                                   | Report                                         |
| Sync delay high                                    | Report without inventing release threshold     |

## 11. Acceptance & Test Matrix

| Source     | Scenario               | Expected Result                         | Test Type    |
| ---------- | ---------------------- | --------------------------------------- | ------------ |
| BR-278     | 100% valid accepted    | Pass gate                               | Evaluation   |
| BR-278     | Valid record lost      | Fail                                    | Evaluation   |
| BR-278     | Safety event lost      | Fail                                    | Safety       |
| BR-278     | Duplicate after resend | Fail                                    | Idempotency  |
| BR-441→443 | Partial failure        | Valid records retained                  | Integration  |
| BR-282     | Report                 | Version/metrics/threshold/result stored | Traceability |

## 12. Open Decisions

No additional numeric delay/retry/error thresholds are introduced in V3 unless separately approved.

# CTMS-097 — Evaluate Buffer and Synchronization Mechanism

## 1. Overview

Story: CTMS-097
Epic: EPIC 17. Reports and Evaluation Metrics
Use Case: Evaluate Buffer and Synchronization Mechanism
Priority: Must Have

Goal:
Allow Admin to evaluate whether offline buffer and synchronization behavior is release-ready under the approved V3 sync gates.

Acceptance summary:
Evaluation must test network loss, app restart, retry, duplicate batch, out-of-order records, and partial failure. PASS requires valid-record acceptance = 100%, lost confirmed safety events = 0, and authoritative duplicate records = 0. Delay, retry, and error metrics are reported as observations.

## 2. Scope

### In Scope

- Evaluation of offline buffer and synchronization release gates.
- Partial-acceptance behavior for batches containing both valid and invalid records.
- Per-record acknowledgement, retry, duplicate, and failed-record behavior.

### Out of Scope

- Implementing runtime offline sync storage or transport.
- Changing the safety event domain rules evaluated by sync.

## 3. Actors & Authorization

- Admin: reviews sync evaluation results.
- System: runs sync evaluation scenarios and records the report.

Only Admin or an authorized evaluation job may run or view release-gate reports.

## 4. Preconditions & Dependencies

- Versioned sync evaluation dataset exists.
- Dataset includes valid records, invalid records, retries, duplicate identifiers, out-of-order records, app restart, and network-loss scenarios.
- Expected per-record outcomes are defined before the run.

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-278 | Buffer/synchronization evaluation must apply BR-436 and V3 partial-acceptance rules BR-441 through BR-443. PASS requires 100% valid records in partial-failure batches accepted, 0 confirmed safety events lost, and 0 authoritative duplicate records after retry/resend. Delay, retry, and error metrics must still be reported. |
| BR-282 | Evaluation reports must store dataset/version, metric value, threshold, rule/model/config version, and pass/fail conclusion. Observational metrics are reported but do not independently fail release. |
| BR-436 | Offline sync evaluation must test network loss, app restart, retry, duplicate batch, out-of-order records, and partial failure. PASS requires 100% valid records accepted even when the same batch contains invalid records, 0 confirmed safety events lost, and 0 authoritative duplicates. Server must return per-record acknowledgement and client retries only failed retryable records. |
| BR-441 | Sync batch V3 uses partial acceptance. Server validates each record independently; valid records commit even when another record in the same batch is invalid. Invalid records must not roll back accepted valid records. |
| BR-442 | Server returns per-record acknowledgement with stable record identifier, result = accepted/duplicate/failed, and failure_reason when failed. Duplicate is terminal success when the same stable identifier was already accepted. |
| BR-443 | Client marks synced only for accepted or duplicate acknowledgements. Client retries only failed retryable records. Failed non-retryable records keep failed state and failure_reason. Retry with the same record or idempotency key must not create an authoritative duplicate. |
| BR-467 | Buffer & Sync PASS requires valid-record acceptance = 100%, lost confirmed events = 0, and authoritative duplicate records = 0. All release-gate metrics must pass. |
| BR-188 | Sync event ordering and evaluation timestamps must use authoritative time rules. |

## 6. State & Lifecycle

```text
Sync record acknowledgement
    ├── accepted -> client may mark synced
    ├── duplicate -> terminal success, client may mark synced
    └── failed -> retry only when failure is retryable; otherwise remain failed with reason
```

## 7. Business Flow

1. Admin or authorized job selects the versioned sync dataset.
2. System runs network loss, app restart, retry, duplicate batch, out-of-order, and partial-failure scenarios.
3. Server validates each record independently and returns per-record acknowledgements.
4. Evaluation verifies valid records commit even when invalid records appear in the same batch.
5. Evaluation verifies duplicate retry/resend does not create a second authoritative record.
6. Evaluation calculates valid-record acceptance, lost confirmed safety events, and authoritative duplicates.
7. PASS is recorded only when all three gate metrics pass.

## 8. Data & Invariants

- A stable record identifier is required to classify accepted, duplicate, and failed outcomes.
- Accepted valid records must not be rolled back because another record in the batch is invalid.
- Duplicate acknowledgement is terminal success, not a retryable failure.
- A failed non-retryable record must retain `failure_reason` for display or audit.
- Retrying the same record or idempotency key must not create an authoritative duplicate.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Batch contains valid and invalid records | Valid records are accepted; invalid records fail independently. |
| Client retries an already accepted stable identifier | Server returns duplicate or equivalent terminal success and creates no duplicate authoritative record. |
| Confirmed safety event disappears after reconnect | Evaluation FAILS. |
| Valid-record acceptance is 99.9% | Evaluation FAILS because threshold is exactly 100%. |
| Per-record acknowledgement omits failure reason for failed record | Report is incomplete and cannot be accepted as release evidence. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| BR-436, BR-441, BR-467 | Batch contains 9 valid records and 1 invalid record | 9 valid records are accepted, invalid record fails, and valid-record acceptance for valid records is 100% | Integration |
| BR-442 | Server processes a sync batch | Each record receives acknowledgement with stable identifier, result, and failure_reason when failed | Contract |
| BR-443 | Client retries an accepted record with the same stable identifier | Server does not create a duplicate; client treats duplicate as terminal success | Idempotency |
| BR-467 | One confirmed safety event is lost after reconnect | Evaluation result is FAIL | Release Gate |
| BR-467 | One authoritative duplicate exists after retry/resend | Evaluation result is FAIL | Release Gate |
| BR-282 | Evaluation report is stored | Report includes dataset/version, thresholds, metric values, rule/config version, and pass/fail conclusion | Report Validation |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.

# CTMS-094 — Report Inaccurate Information or Dangerous Content

## 1. Overview

Story: CTMS-094

Epic: EPIC 16. Reviews and Feedback

Use Case: Report Inaccurate Information or Dangerous Content

Priority: Should Have

Goal: Allow a user to report supported inaccurate or dangerous content and provide authorized Admin with a trackable moderation case.

Backlog story: As a user, I want to report inaccurate information or dangerous content so it can be reviewed by the system's moderation process.

Acceptance Criteria:

| Source  | Criterion                                          |
| ------- | -------------------------------------------------- |
| PB AC-1 | User selects a supported report type.              |
| PB AC-2 | Report references a supported target.              |
| PB AC-3 | User provides a description.                       |
| PB AC-4 | Report has a trackable status.                     |
| PB AC-5 | Authorized Admin can review report status/context. |
| PB AC-6 | Moderation must not expose unrelated data.         |

## 2. Scope

### In Scope

- Supported report type.
- Supported report target.
- Description.
- Trackable report status.
- Admin moderation visibility.

### Out of Scope

- Automatic deletion of reported content.
- Automatic determination that reported content is actually dangerous.
- AI unsafe-answer feedback workflow when handled specifically by CTMS-072/073.

## 3. Actors & Authorization

Actors:

- User — creates report.
- Authorized Admin — reviews/moderates report.

Admin access must be limited to applicable moderation data.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-003.

Target must be a supported reportable object/content type.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-275     | A report must use a supported report type/target and include a description, maintain a trackable status, and allow authorized Admin moderation without exposing unrelated data.                                                                        |
| BR-287     | Admin moderation must display reporter, target type/ID, reason, and status; only valid Pending/Reviewing/Actioned/Rejected transitions are allowed, and every moderation decision must be audited.                                                     |
| BR-174     | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                          |
| BR-188     | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |
| BR-306     | A reported review must be handled through the moderation policy. Review history and audit records must not be hard-deleted during content handling.                                                                                                    |

## 6. State & Lifecycle

Report created
→ trackable moderation state.

Applicable moderation lifecycle follows the authoritative moderation states defined by BR-287.

## 7. Business Flow

1. User opens report action.
2. Select supported report type.
3. Identify supported target.
4. Enter description.
5. Backend validates input and target.
6. Persist report.
7. Initialize trackable moderation status.
8. Authorized Admin reviews report.
9. Admin performs valid moderation transition.
10. Audit moderation decision.

## 8. Data & Invariants

Report contains applicable:

- reporter;
- report type;
- target type/ID;
- description/reason;
- status;
- timestamps.

Report must not grant Admin or reporter access to unrelated protected data.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                          | Expected Behavior                        |
| ----------------------------- | ---------------------------------------- |
| Supported target/type         | Report accepted                          |
| Unsupported type              | Reject                                   |
| Unsupported target            | Reject                                   |
| Missing description           | Reject                                   |
| Unauthorized moderation       | Reject                                   |
| Invalid moderation transition | Reject                                   |
| Admin reviews report          | Only relevant moderation context exposed |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result | Test Type     |
| ------ | ------------------------ | --------------- | ------------- |
| BR-275 | Valid report             | Created         | E2E           |
| BR-275 | Missing description      | Rejected        | Validation    |
| BR-275 | Unsupported target       | Rejected        | Negative      |
| BR-287 | Authorized Admin         | Can review      | Authorization |
| BR-287 | Invalid state transition | Rejected        | State         |
| BR-287 | Moderation decision      | Audited         | Audit         |

## 12. Open Decisions

Exact supported report-type and target-type catalogs must follow authoritative configuration/domain definitions.

# CTMS-073 — Review AI Answers Reported as Dangerous

## 1. Overview

Story: CTMS-073

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Review AI Answers Reported as Dangerous

Priority: Must Have

Goal: Allow authorized Admin to review AI feedback reported as unsafe and record a traceable moderation outcome.

Backlog story: As an Admin, I want to review AI answers reported as unsafe so dangerous guidance can be investigated and handled.

Acceptance Criteria:

| Source  | Criterion                                                           |
| ------- | ------------------------------------------------------------------- |
| PB AC-1 | Only authorized Admin may review unsafe AI feedback.                |
| PB AC-2 | Moderation applies to feedback with `reported_unsafe = true`.       |
| PB AC-3 | Review status follows valid pending/reviewing/actioned transitions. |
| PB AC-4 | Moderation records reviewer and review time.                        |
| PB AC-5 | Resolution note is recorded when handling the report.               |
| PB AC-6 | Moderation action is audited.                                       |

## 2. Scope

### In Scope

- Unsafe-feedback queue.
- Authorized Admin review.
- Review lifecycle.
- Reviewer/time.
- Resolution note.
- Moderation audit.

### Out of Scope

- Camper feedback creation — CTMS-072.
- Automatic rewriting of AI output.
- Automatic source-document modification.

## 3. Actors & Authorization

- Authorized Admin only.

Non-Admin users cannot perform moderation transitions.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-072.

Feedback exists with `reported_unsafe = true`.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-253     | Only an authorized Admin may review feedback with reported_unsafe = true. review_status may transition only among pending, reviewing, and actioned through valid transitions. Each moderation action must store the reviewer, timestamp, resolution_note, and an audit record. |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                           |
| BR-192     | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                       |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                          |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                   |

## 6. State & Lifecycle

`pending`
→ `reviewing`
→ `actioned`

Only approved transitions are valid.

No silent status skipping unless authoritative transition policy explicitly permits it.

## 7. Business Flow

1. Admin opens unsafe-feedback queue.
2. Verify Admin authorization.
3. Load feedback with unsafe flag.
4. Review question, answer and available source context.
5. Move pending → reviewing.
6. Determine moderation outcome.
7. Enter resolution note.
8. Move reviewing → actioned.
9. Store reviewer/time.
10. Audit moderation action.

## 8. Data & Invariants

Moderation record contains:

- feedback;
- review status;
- reviewer;
- review timestamp;
- resolution note;
- audit reference/context.

Only unsafe-reported feedback belongs in this moderation workflow.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                                    | Expected Behavior           |
| ------------------------------------------------------- | --------------------------- |
| Camper tries moderation                                 | Reject                      |
| Admin reviews non-unsafe feedback through this workflow | Reject/not eligible         |
| Invalid state transition                                | Reject                      |
| Action without resolution note                          | Reject according to BR-253  |
| Concurrent moderation update                            | Detect stale state/conflict |
| Successful action                                       | Audit moderation            |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result                 | Test Type     |
| ------ | -------------------- | ------------------------------- | ------------- |
| BR-253 | Authorized Admin     | Review allowed                  | Authorization |
| BR-253 | Non-Admin            | Rejected                        | Security      |
| BR-253 | pending → reviewing  | Valid                           | State         |
| BR-253 | reviewing → actioned | Valid                           | State         |
| BR-253 | Invalid transition   | Rejected                        | Negative      |
| BR-253 | Action completed     | Reviewer/time/note/audit stored | Audit         |

## 12. Open Decisions

Specific moderation remedies after `actioned` are not defined by BR-253 and must not be invented here.

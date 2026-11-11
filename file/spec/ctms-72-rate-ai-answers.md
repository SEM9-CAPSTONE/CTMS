# CTMS-072 — Rate AI Answers

## 1. Overview

Story: CTMS-072

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Rate AI Answers

Priority: Should Have

Goal: Allow Camper to provide usefulness and safety feedback on AI answers, including while temporarily offline.

Backlog story: As a Camper, I want to rate AI answers and report unsafe guidance so the system can identify answer-quality and safety problems.

Acceptance Criteria:

| Source  | Criterion                                                    |
| ------- | ------------------------------------------------------------ |
| PB AC-1 | Camper may rate an AI answer Useful or Not Useful.           |
| PB AC-2 | Camper may report an AI answer as unsafe.                    |
| PB AC-3 | Feedback stores rating and unsafe flag.                      |
| PB AC-4 | Reason is optional.                                          |
| PB AC-5 | Feedback created offline is synchronized after reconnection. |

## 2. Scope

### In Scope

- Useful.
- Not Useful.
- Unsafe report.
- Optional reason.
- Offline feedback.
- Later synchronization.

### Out of Scope

- Admin unsafe-review workflow — CTMS-073.
- AI answer regeneration.
- Automatic modification of the knowledge base.

## 3. Actors & Authorization

- Camper.
- Synchronization subsystem.

Camper may provide feedback on an AI answer available to that Camper.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-069.

AI answer exists.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-252     | A Camper may rate an AI answer as Useful or Not Useful and may report it as unsafe. Feedback must store the rating and unsafe flag; a reason is optional. Feedback created offline must synchronize after connectivity returns. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                           |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                    |

## 6. State & Lifecycle

AI answer
→ feedback created.

If online:
→ persisted/synchronized.

If offline:
→ local pending feedback
→ reconnect
→ synchronized.

Unsafe feedback becomes eligible for CTMS-073 moderation.

## 7. Business Flow

1. Camper views AI answer.
2. Select Useful or Not Useful.
3. Optionally mark unsafe.
4. Optionally provide reason.
5. Submit feedback.
6. Persist feedback.
7. If offline, store pending locally.
8. Synchronize after reconnection.
9. If unsafe flag is true, expose to authorized moderation workflow.

## 8. Data & Invariants

Feedback contains:

- AI answer reference;
- rating;
- unsafe flag;
- optional reason;
- user/context as required;
- synchronization metadata where offline.

Rating domain:

- Useful;
- Not Useful.

Reason is not mandatory.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                | Expected Behavior             |
| ------------------- | ----------------------------- |
| Useful selected     | Valid feedback                |
| Not Useful selected | Valid feedback                |
| No reason           | Still valid                   |
| Unsafe checked      | Flag stored                   |
| Offline             | Feedback retained for sync    |
| Reconnect           | Pending feedback synchronized |

## 11. Acceptance & Test Matrix

| Source | Scenario           | Expected Result       | Test Type  |
| ------ | ------------------ | --------------------- | ---------- |
| BR-252 | Useful             | Rating stored         | Functional |
| BR-252 | Not Useful         | Rating stored         | Functional |
| BR-252 | Unsafe report      | unsafe=true           | Safety     |
| BR-252 | Reason absent      | Feedback accepted     | Boundary   |
| BR-252 | Offline submission | Stored locally        | Offline    |
| BR-252 | Reconnect          | Feedback synchronized | E2E        |

## 12. Open Decisions

None.

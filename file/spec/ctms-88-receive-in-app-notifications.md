# CTMS-088 — Receive In-App Notifications

## 1. Overview

Story: CTMS-088

Epic: EPIC 15. Notifications

Use Case: Receive In-App Notifications

Priority: Must Have

Goal: Persist eligible in-app notifications with read/unread state and a valid reference to the related CTMS object or action where applicable.

Backlog story: As a user, I want to receive in-app notifications so I can see relevant CTMS events and navigate to their related context.

Acceptance Criteria:

| Source  | Criterion                                                                                   |
| ------- | ------------------------------------------------------------------------------------------- |
| PB AC-1 | Eligible notification is persisted.                                                         |
| PB AC-2 | Notification has read/unread state.                                                         |
| PB AC-3 | Notification contains a valid link/reference to related CTMS object/action when applicable. |
| PB AC-4 | Notification must not link to an unrelated or inaccessible object.                          |

## 2. Scope

### In Scope

- In-app notification persistence.
- Read/unread state.
- CTMS object/action reference.
- Notification navigation.

### Out of Scope

- Background push — CTMS-090.
- Notification preferences — CTMS-091.
- Missed-alert recovery — CTMS-089.

## 3. Actors & Authorization

- Eligible authenticated user.
- Notification subsystem.

User must only receive/access notifications and linked resources within applicable authorization.

## 4. Preconditions & Dependencies

A supported CTMS event produces an eligible notification.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-271     | An in-app notification must be persisted with read/unread state and, when applicable, a valid link/reference to the relevant CTMS object or action.                                   |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

Notification event
→ persisted `unread`
→ displayed
→ user reads
→ `read`.

The underlying CTMS object's lifecycle remains separate.

## 7. Business Flow

1. Supported event occurs.
2. Determine eligible recipient.
3. Create notification.
4. Associate applicable CTMS reference/action.
5. Persist as unread.
6. User opens notification center.
7. Display notification.
8. Mark/read according to approved interaction.
9. Navigate to related authorized context when selected.

## 8. Data & Invariants

Notification includes applicable:

- recipient;
- event/reference;
- read/unread state;
- related object/action;
- event/notification time.

Reference must not intentionally point to an unrelated CTMS entity.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                      |
| --------------------------- | ------------------------------------------------------ |
| New eligible event          | Notification persisted unread                          |
| User reads notification     | State becomes read                                     |
| Related object exists       | Valid navigation                                       |
| Related object inaccessible | Do not bypass authorization                            |
| No applicable target        | Reference may be absent if legitimately not applicable |

## 11. Acceptance & Test Matrix

| Source | Scenario                   | Expected Result        | Test Type   |
| ------ | -------------------------- | ---------------------- | ----------- |
| BR-271 | Eligible event             | Notification persisted | Integration |
| BR-271 | New notification           | unread                 | State       |
| BR-271 | Read action                | read                   | State       |
| BR-271 | Applicable target          | Valid reference        | Integration |
| BR-271 | Unauthorized target access | Rejected               | Security    |

## 12. Open Decisions

Exact supported notification-event catalog belongs to notification configuration/domain rules.

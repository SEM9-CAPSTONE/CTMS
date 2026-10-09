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
| PB AC-5 | Eligible realtime in-app events may be displayed immediately to connected users while still respecting authorization. |

## 2. Scope

### In Scope

- In-app notification persistence.
- Read/unread state.
- CTMS object/action reference.
- Notification navigation.
- Realtime in-app notification delivery for supported Trip review events.

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
| BR-301     | Supported Trip review events include: new Trip submitted for Admin review, pending Trip review reminder before the 24-hour deadline, and automatic rejection after the 24-hour approval deadline. Admin review events must be delivered only to eligible Admin users; automatic rejection events must be delivered only to the owning Host. |
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
6. If the user is connected and the event supports realtime delivery, display the in-app event immediately.
7. User opens notification center.
8. Display notification.
9. Mark/read according to approved interaction.
10. Navigate to related authorized context when selected.

### Trip Review Events

1. Trip enters `pending_approval`.
2. System notifies eligible Admin users that a new Trip requires review.
3. Trip remains pending near the 24-hour approval deadline.
4. System reminds eligible Admin users that review is still required.
5. Trip remains pending after the 24-hour deadline.
6. System automatically rejects the Trip and notifies the owning Host.

## 8. Data & Invariants

Notification includes applicable:

- recipient;
- event/reference;
- read/unread state;
- related object/action;
- event/notification time.

Reference must not intentionally point to an unrelated CTMS entity.

Trip review notifications must reference the related Trip and must not be visible to users outside the Admin review scope or the owning Host scope.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                      |
| --------------------------- | ------------------------------------------------------ |
| New eligible event          | Notification persisted unread                          |
| New Trip submitted for review | Admin receives an in-app notification for the pending Trip |
| Pending Trip near 24-hour review deadline | Admin receives a reminder notification once for the review window |
| Trip automatically rejected after 24 hours | Owning Host receives an in-app notification |
| Unrelated Host/Admin user | Notification is not delivered and target is not accessible |
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
| BR-301 | Trip submitted for review | Eligible Admin users are notified | Integration / E2E |
| BR-301 | Pending Trip near deadline | Eligible Admin users are reminded once | Unit / Integration |
| BR-301 | Trip auto-rejected after 24 hours | Owning Host is notified | Unit / Integration / E2E |
| BR-301 | User is not eligible for Trip review notification | Notification is not delivered and target access is rejected | Security |

## 12. Open Decisions

Exact supported notification-event catalog belongs to notification configuration/domain rules.

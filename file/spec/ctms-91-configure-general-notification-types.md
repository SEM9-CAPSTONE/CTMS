# CTMS-091 — Configure General Notification Types

## 1. Overview

Story: CTMS-091

Epic: EPIC 15. Notifications

Use Case: Configure General Notification Types

Priority: Could Have

Goal: Allow users to configure supported noncritical notification types without allowing mandatory emergency or safety alerts for an active Trip to be disabled.

Backlog story: As a user, I want to configure general notification types so I can control which noncritical notifications I receive.

Acceptance Criteria:

| Source  | Criterion                                                                                   |
| ------- | ------------------------------------------------------------------------------------------- |
| PB AC-1 | User may enable or disable each supported noncritical notification type.                    |
| PB AC-2 | Mandatory emergency/safety alerts for an active Trip cannot be disabled.                    |
| PB AC-3 | Saved notification preferences apply only to notification categories that are configurable. |
| PB AC-4 | Preference changes must not suppress mandatory active-Trip safety alerts.                   |

## 2. Scope

### In Scope

- Supported noncritical notification preferences.
- Enable/disable configuration.
- Mandatory emergency/safety protection.

### Out of Scope

- In-app notification creation — CTMS-088.
- Missed-alert recovery — CTMS-089.
- Background push delivery — CTMS-090.
- Disabling mandatory active-Trip emergency/safety alerts.

## 3. Actors & Authorization

Primary actor:

- Authenticated User.

A user may configure only their own notification preferences unless another administrative capability explicitly permits otherwise.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-088.

Supported notification types are configured by the system.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-274 | Users may enable or disable supported noncritical notification types, but mandatory emergency/safety alerts for an active Trip must remain enabled.                                                                                           |
| BR-194 | Notification/event side effects may be queued or emitted only after the primary business transaction commits successfully, preferably through an outbox/queue. Notification failure must not roll back the already-committed business result. |
| BR-195 | A single business event must not create duplicate notifications for the same recipient, target object, and event type.                                                                                                                        |
| BR-196 | Users may disable ordinary notifications, but mandatory safety or emergency alerts for an active related Trip must not be suppressible.                                                                                                       |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                         |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                  |

## 6. State & Lifecycle

For configurable notification types:

`enabled ↔ disabled`

For mandatory active-Trip emergency/safety notifications:

`enabled`

User preference cannot transition these mandatory alerts to disabled while the mandatory condition applies.

## 7. Business Flow

1. User opens notification settings.
2. System loads supported notification types.
3. Identify configurable and mandatory types.
4. User changes one or more noncritical preferences.
5. Backend validates ownership and configurability.
6. Reject attempts to disable mandatory active-Trip emergency/safety alerts.
7. Persist valid preferences.
8. Apply preferences to future eligible notification delivery.

## 8. Data & Invariants

Preference data includes applicable:

- user;
- notification type;
- enabled/disabled state.

Invariant:

`mandatory active-Trip emergency/safety alert = enabled`

A general preference must not override a stronger safety rule.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                                              | Expected Behavior                          |
| ----------------------------------------------------------------- | ------------------------------------------ |
| Disable supported noncritical type                                | Allowed                                    |
| Re-enable supported type                                          | Allowed                                    |
| Disable mandatory active-Trip safety alert                        | Reject                                     |
| Modify another user's preference                                  | Reject                                     |
| Unsupported notification type                                     | Reject                                     |
| Existing disabled preference becomes mandatory due to active Trip | Mandatory safety behavior takes precedence |

## 11. Acceptance & Test Matrix

| Source | Scenario                       | Expected Result                 | Test Type  |
| ------ | ------------------------------ | ------------------------------- | ---------- |
| BR-274 | Disable noncritical type       | Preference saved                | Functional |
| BR-274 | Re-enable type                 | Preference saved                | Functional |
| BR-274 | Disable mandatory safety alert | Rejected                        | Safety     |
| BR-274 | Active Trip exists             | Mandatory alerts remain enabled | E2E        |
| BR-213 | Invalid notification type      | Rejected                        | Negative   |

## 12. Open Decisions

Exact list of configurable noncritical notification types belongs to authoritative notification configuration.

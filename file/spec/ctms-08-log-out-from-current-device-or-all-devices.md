# CTMS-008 — Log Out from Current Device or All Devices

## 1. Overview

Story: CTMS-008

Epic: EPIC 1. Authentication

Use Case: Log Out from Current Device or All Devices

Priority: Should Have

Goal: Allow a user to terminate the current refresh session or all active refresh sessions.

Backlog story:
As a User, I want to log out from the current device or all devices so I can protect my account.

Acceptance Criteria:

| Source  | Criterion                                                  |
| ------- | ---------------------------------------------------------- |
| PB AC-1 | User can log out from the current device.                  |
| PB AC-2 | User can log out from all devices.                         |
| PB AC-3 | Revoked refresh credentials cannot refresh authentication. |
| PB AC-4 | Logout-all is idempotent.                                  |

## 2. Scope

### In Scope

- Current-device logout.
- All-device logout.
- Refresh-session revocation.
- Idempotent logout-all behavior.

### Out of Scope

- Access-token refresh.
- Initial login.
- Password reset.

## 3. Actors & Authorization

Primary actor: authenticated User.

A user may revoke their own applicable session(s).

## 4. Preconditions & Dependencies

Dependencies: CTMS-003.

User has an authenticated account/session context applicable to logout.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-023 | Logging out from the current device must revoke the refresh token/session for that device only. The current access token must not be renewable using the revoked refresh token.       |
| BR-024 | Logging out from all devices must revoke every still-valid refresh token belonging to the user. The operation must be idempotent.                                                     |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

Current-device logout:

Active device refresh session
→ revoked.

Logout-all:

All active refresh sessions
→ revoked.

Repeating logout-all:
revoked
→ revoked.

## 7. Business Flow

1. User chooses current-device logout or logout-all.
2. System resolves authoritative refresh session(s).
3. Current-device mode revokes only the applicable current refresh session.
4. All-devices mode revokes all active refresh sessions for the user.
5. Future refresh attempts using revoked credentials fail.

## 8. Data & Invariants

- Revocation cannot restore a session.
- Current-device logout must not revoke unrelated device sessions unless specified by logout-all.
- Logout-all final state is all refresh sessions revoked.
- Repeating logout-all preserves the same final state.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                            | Expected Behavior                                |
| ------------------------------- | ------------------------------------------------ |
| Current session already revoked | Remains revoked.                                 |
| Logout-all repeated             | Same final state; no inconsistency.              |
| Revoked token used afterward    | Refresh rejected.                                |
| Current-device logout           | Other device refresh sessions remain unaffected. |
| Current access token exists     | Logout does not extend its lifetime.             |

## 11. Acceptance & Test Matrix

| Source           | Scenario                                   | Expected Result                  | Test Type   |
| ---------------- | ------------------------------------------ | -------------------------------- | ----------- |
| PB AC-1 / BR-023 | Current-device logout                      | Current refresh session revoked. | E2E         |
| BR-023           | Reuse current revoked token                | Refresh rejected.                | Integration |
| PB AC-2 / BR-024 | Logout-all                                 | All refresh sessions revoked.    | E2E         |
| PB AC-4 / BR-024 | Repeat logout-all                          | Same final state.                | Idempotency |
| BR-024           | Token from another device after logout-all | Refresh rejected.                | E2E         |

## 12. Open Decisions

None.

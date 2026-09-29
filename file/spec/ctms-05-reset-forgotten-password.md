# CTMS-005 — Reset Forgotten Password

## 1. Overview

Story: CTMS-005

Epic: EPIC 1. Authentication

Use Case: Reset Forgotten Password

Priority: Must Have

Goal: Allow an account owner who proves ownership to establish a new password and invalidate existing refresh sessions.

Backlog story:
As a User, I want to reset my forgotten password so I can regain access to my account.

Acceptance Criteria:

| Source  | Criterion                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------- |
| PB AC-1 | User can reset a forgotten password after satisfying the applicable ownership-verification rules. |
| PB AC-2 | Invalid recovery attempts do not change the password.                                             |
| PB AC-3 | New password satisfies the active password policy.                                                |
| PB AC-4 | Successful reset revokes active refresh sessions.                                                 |

## 2. Scope

### In Scope

- Verify recovery ownership.
- Validate recovery credential.
- Validate new password.
- Hash new password.
- Persist password reset.
- Revoke active refresh tokens.

### Out of Scope

- Initial account verification.
- Login.
- Provider-specific recovery delivery infrastructure.

## 3. Actors & Authorization

Primary actor: User recovering their own account.

Recovery authorization is established through the approved ownership-verification credential.

## 4. Preconditions & Dependencies

Dependencies: CTMS-001.

Before password reset:

- Account ownership must be proven.
- Recovery credential must be valid.
- Recovery credential must have correct purpose.
- Credential must be unused.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-014 | A password-reset request may proceed only after ownership has been verified using a still-valid, unused OTP or reset token/link issued for the correct purpose.                                                                                                                                         |
| BR-015 | A new password must comply with the current password policy and must never be stored or logged in plaintext.                                                                                                                                                                                            |
| BR-016 | After a password reset succeeds, all still-valid refresh tokens for that user must be revoked either within the same business operation or immediately after commit through a consistent mechanism.                                                                                                     |
| BR-171 | Any function requiring an active account must re-check account status on the backend at request time. pending_verification, suspended, or deleted accounts must be denied even when the client still holds an older access token/session, except for explicitly allowed verification or recovery flows. |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs/API responses must not expose them.                                                                                                                                                                        |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                   |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                            |

## 6. State & Lifecycle

Recovery pending
→ valid ownership proof
→ valid new password
→ password reset

After successful reset:

Active refresh sessions
→ revoked

Invalid recovery:
→ password unchanged.

## 7. Business Flow

1. User initiates recovery.
2. System verifies recovery credential and purpose.
3. User submits new password.
4. System validates active password policy.
5. System hashes the password.
6. System persists the new password.
7. System revokes all active refresh tokens.
8. Old refresh credentials can no longer refresh sessions.

## 8. Data & Invariants

- Password changes only after valid ownership proof.
- Raw new password is never persisted.
- Invalid recovery leaves existing password unchanged.
- Successful reset invalidates existing refresh sessions.
- Reset and session revocation must not leave an unsafe partially authoritative state.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                          | Expected Behavior                                                    |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Invalid recovery credential                   | Reject.                                                              |
| Expired credential                            | Reject.                                                              |
| Consumed credential                           | Reject.                                                              |
| Wrong-purpose credential                      | Reject.                                                              |
| New password violates policy                  | Reject; existing password remains.                                   |
| Old refresh token after successful reset      | Reject.                                                              |
| Password update succeeds but revocation fails | Must not leave an unsafe partially successful authoritative outcome. |

## 11. Acceptance & Test Matrix

| Source           | Scenario                  | Expected Result                    | Test Type   |
| ---------------- | ------------------------- | ---------------------------------- | ----------- |
| PB AC-1 / BR-014 | Valid recovery proof      | Reset may proceed.                 | Integration |
| BR-014           | Wrong-purpose token       | Rejected.                          | Security    |
| PB AC-3 / BR-015 | Weak/invalid new password | Rejected.                          | Boundary    |
| BR-015           | Persisted password        | Stored as hash, not plaintext.     | Security    |
| PB AC-4 / BR-016 | Successful reset          | All active refresh tokens revoked. | E2E         |
| BR-016           | Old token after reset     | Refresh rejected.                  | E2E         |

## 12. Open Decisions

The mapped rules permit OTP or reset token/link but do not define the provider-specific reset-token format.

That contract remains TBD — Technical Design.

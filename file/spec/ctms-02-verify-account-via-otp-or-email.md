# CTMS-002 — Verify Account via OTP or Email

## 1. Overview

Story: CTMS-002

Epic: EPIC 1. Authentication

Use Case: Verify Account via OTP or Email

Priority: Must Have

Goal: Allow a pending account owner to verify account ownership through the approved OTP or email-verification mechanism.

Backlog story:
As a User, I want to verify my account via OTP or email so I can securely activate and use my CTMS account.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| PB AC-1 | User can verify an account using the supported OTP or email-verification mechanism when the credential is valid. |
| PB AC-2 | Invalid verification attempts do not produce a false successful verification state. |
| PB AC-3 | Wrong, expired, consumed, or over-attempt OTPs cannot activate the account. |
| PB AC-4 | A valid verification credential can produce the verified account outcome only once. |

## 2. Scope

### In Scope

- Verify ownership of a pending account.
- Validate verification purpose and target user.
- Enforce OTP expiry and consumption.
- Enforce verification attempt and resend limits.
- Prevent OTP reuse.
- Transition the account to the authoritative verified outcome.

### Out of Scope

- Account registration.
- Login-session creation.
- Password recovery.
- Provider-specific email/SMS infrastructure.

## 3. Actors & Authorization

Primary actor: User owning the pending account.

Verification authority belongs to the backend.

Possession of an arbitrary OTP is not sufficient; the credential must match the correct user and purpose.

## 4. Preconditions & Dependencies

Dependencies: CTMS-001.

Preconditions:

- Target account exists.
- Verification credential was issued for the applicable account/purpose.
- Credential has not already been successfully consumed.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-006 | An OTP is valid only when it matches the required purpose, belongs to the correct user, has not been consumed, and has not passed expires_at. The OTP TTL must come from system configuration.                                                         |
| BR-007 | OTP resend and verification operations must enforce a maximum of four attempts together with the configured rate limits. Requests beyond the limit must be rejected and must not result in unlimited OTP generation.                                   |
| BR-008 | An incorrect, expired, already-consumed OTP, or an OTP that exceeds the allowed attempt limit must not activate the account. A valid OTP may be consumed only once.                                                                                    |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs/API responses must not expose them.                                                                                                                       |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone. |
| BR-190 | OTP TTL, token TTL, attempt limits, rate limits, Booking hold duration, and retry deadlines must come from configuration and must not be hard-coded in business logic.                                                                                 |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |

## 6. State & Lifecycle

`pending_verification`
→ valid verification
→ verified/active account outcome

Invalid verification:

`pending_verification`
→ invalid/expired/consumed credential
→ remains unverified

A consumed credential cannot produce another successful verification.

## 7. Business Flow

1. User submits or opens the approved verification mechanism.
2. System resolves target account and verification purpose.
3. System validates credential ownership and purpose.
4. System checks expiry.
5. System checks consumed state.
6. System checks configured rate/attempt limits.
7. System validates credential correctness.
8. System atomically consumes the valid credential and applies the verified account outcome.
9. Further use of the same credential is rejected.

## 8. Data & Invariants

- Verification credential belongs to one user and purpose.
- OTP TTL is configuration-driven.
- Maximum verification attempts are four under the mapped rule.
- Consumed OTP cannot be reused.
- Invalid verification cannot activate an account.
- OTP values must not be exposed through logs or responses.

## 9. API / Integration Contract

TBD — Technical Design.

The source names both OTP and email verification. Provider-specific email-link token structure is not defined here and must not be invented by this spec.

## 10. Error & Edge Cases

| Case | Expected Behavior |
| --- | --- |
| OTP belongs to another user | Reject. |
| OTP has wrong purpose | Reject. |
| OTP expired | Reject; account remains unverified. |
| OTP already consumed | Reject. |
| Wrong OTP | Reject and enforce attempt policy. |
| More than four attempts | Reject according to configured policy. |
| Resend rate limit exceeded | Reject without unlimited OTP creation. |
| Same valid OTP submitted concurrently | At most one authoritative verification succeeds. |

## 11. Acceptance & Test Matrix

| Source | Scenario | Expected Result | Test Type |
| --- | --- | --- | --- |
| PB AC-1 / BR-006 | Valid OTP | Account verification succeeds. | Integration |
| PB AC-2 / BR-008 | Wrong OTP | No verification state change. | Integration |
| BR-006 | Expired OTP | Rejected. | Boundary |
| BR-007 | Fifth verification attempt | Rejected according to attempt policy. | Boundary |
| BR-008 | Reuse consumed OTP | Rejected. | Integration |
| BR-008 | Concurrent use of same OTP | Only one success. | Concurrency |
| BR-185 | Inspect logs | Raw OTP is not exposed. | Security |

## 12. Open Decisions

The source supports both OTP and email verification but does not define a separate email-link token contract.

Email-link token generation, storage and transport remain TBD in Technical Design unless another approved source defines them.
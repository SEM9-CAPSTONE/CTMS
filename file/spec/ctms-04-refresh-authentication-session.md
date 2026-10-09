# CTMS-004 — Refresh Authentication Session

## 1. Overview

Story: CTMS-004

Epic: EPIC 1. Authentication

Use Case: Refresh Authentication Session

Priority: Must Have

Goal: Allow an existing valid session to obtain a new access token without requiring full login.

Backlog story:
As a User, I want to refresh my authentication session so I do not need to log in again while my refresh session remains valid.

Acceptance Criteria:

| Source  | Criterion                                                                       |
| ------- | ------------------------------------------------------------------------------- |
| PB AC-1 | A valid eligible refresh token can refresh the authentication session.          |
| PB AC-2 | Invalid refresh attempts do not issue a new access token.                       |
| PB AC-3 | Expired, revoked, mismatched, or rotation-replaced refresh tokens are rejected. |
| PB AC-4 | Refresh-token rotation is applied when configured.                              |

## 2. Scope

### In Scope

- Validate refresh token.
- Validate expiry and revocation.
- Validate user/device binding.
- Validate rotation state.
- Issue new access token.
- Apply configured refresh-token rotation.
- End an idle web session after the configured inactivity timeout (BR-465).

### Out of Scope

- Initial login.
- Logout.
- Password reset.
- Business authorization.

## 3. Actors & Authorization

Primary actor: User through an existing refresh session.

The refresh credential is the authentication basis for this workflow.

## 4. Preconditions & Dependencies

Dependencies: CTMS-003.

Refresh credential must:

- Exist.
- Be unexpired.
- Be non-revoked.
- Match correct user/device.
- Pass applicable rotation checks.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-012 | A refresh token may issue a new access token only if it is unexpired, not revoked, associated with the correct user and device, and passes rotation checks. When refresh-token rotation is enabled, a successful refresh must rotate the token.        |
| BR-013 | A refresh token that is expired, revoked, associated with the wrong user or device, or superseded by token rotation must be rejected and must not issue a new access token.                                                                            |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs/API responses must not expose them.                                                                                                                       |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone. |
| BR-190 | OTP TTL, token TTL, attempt limits, rate limits, Booking hold duration, and retry deadlines must come from configuration and must not be hard-coded in business logic.                                                                                 |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                           |
| BR-465 | The web client must end an authenticated session after the configured idle timeout (default 30 minutes) with no user interaction in any open CTMS tab: revoke the refresh token through logout, clear stored session data, and redirect to login. Any interaction resets the countdown; interaction after the deadline has passed must not revive the session. |

## 6. State & Lifecycle

Valid refresh session
→ refresh
→ new access token
→ optional refresh-token rotation

Invalid refresh credential
→ rejected
→ no new access token

Rotation-replaced token
→ invalid for future refresh.

Active web session
→ no user interaction for the idle timeout
→ logout (refresh token revoked) and local session cleared
→ login required.

## 7. Business Flow

1. Client submits refresh credential.
2. System resolves persisted refresh/session record.
3. System validates expiry.
4. System validates revocation.
5. System validates user/device binding.
6. System validates rotation state.
7. System issues new access token.
8. System rotates refresh token when configured.
9. Replaced token is no longer eligible.

### Idle Timeout (Web Client)

1. Client records the time of the last user interaction (pointer, keyboard, wheel, scroll, touch), shared by all open CTMS tabs.
2. Any interaction restarts the idle countdown.
3. When the countdown reaches the idle timeout, client calls logout to revoke the refresh token.
4. Client clears stored tokens and user data and redirects to login, even if the logout request fails.
5. On page load, and when a tab becomes visible again, client re-checks the deadline; a session already past it is ended immediately.

## 8. Data & Invariants

- Invalid refresh token cannot create an access token.
- Revoked token cannot become valid again.
- Replaced token cannot be reused.
- Token TTL is configuration-driven.
- Token secrets must not be exposed.
- Idle timeout is configuration-driven (BR-190); default 30 minutes.
- The last-interaction timestamp is not a secret and contains no token data.
- An idle-expired session cannot be revived by later interaction; the user must log in again.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                                        |
| --------------------------------------- | -------------------------------------------------------- |
| Expired token                           | Reject.                                                  |
| Revoked token                           | Reject.                                                  |
| Wrong user/device binding               | Reject.                                                  |
| Rotation-replaced token                 | Reject.                                                  |
| Concurrent reuse of replaced credential | Must not create multiple authoritative refresh outcomes. |
| User active in another tab              | Session stays active in every tab.                       |
| Device sleeps past the idle timeout     | Session ended on wake or next interaction.               |
| Tab reopened after the idle timeout     | Session ended immediately; redirect to login.            |
| Logout request fails on idle timeout    | Local session still cleared; redirect to login.          |

## 11. Acceptance & Test Matrix

| Source           | Scenario              | Expected Result                 | Test Type                 |
| ---------------- | --------------------- | ------------------------------- | ------------------------- |
| PB AC-1 / BR-012 | Valid refresh token   | New access token issued.        | Integration               |
| BR-012           | Rotation enabled      | Refresh credential rotated.     | Integration               |
| BR-013           | Expired token         | Rejected.                       | Boundary                  |
| BR-013           | Revoked token         | Rejected.                       | Integration               |
| BR-013           | Replaced token reused | Rejected.                       | Concurrency / Integration |
| BR-190           | Change configured TTL | Behavior follows configuration. | Configuration             |
| BR-465           | No interaction for the idle timeout | Logged out, refresh token revoked, redirected to login. | Unit / E2E |
| BR-465           | Interaction before the idle timeout | Countdown resets; session stays active. | Unit |
| BR-465           | Interaction after the deadline (device slept) | Session not revived; logged out. | Unit |
| BR-465           | Activity in another tab | Session stays active in all tabs. | Unit / E2E |

## 12. Open Decisions

- Whether "Ghi nhớ" (remember me) on login should exempt a session from the idle timeout. Current behavior: it does not.

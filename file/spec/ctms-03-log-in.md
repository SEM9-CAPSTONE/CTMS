# CTMS-003 — Log In

## 1. Overview

Story: CTMS-003

Epic: EPIC 1. Authentication

Use Case: Log In

Priority: Must Have

Goal: Authenticate an active CTMS user and establish an authentication session.

Backlog story:
As a User, I want to log in so I can access CTMS functions permitted to my account.

Acceptance Criteria:

| Source  | Criterion                                                                             |
| ------- | ------------------------------------------------------------------------------------- |
| PB AC-1 | User can log in using valid credentials when account conditions are satisfied.        |
| PB AC-2 | Invalid login produces an appropriate failure outcome without false success.          |
| PB AC-3 | Invalid credentials display an appropriate error without revealing account existence. |
| PB AC-4 | A locked/non-active account cannot establish a normal authentication session.         |

## 2. Scope

### In Scope

- Validate login credentials.
- Validate account status.
- Create authentication session.
- Issue access token and refresh token.
- Bind refresh session/token to corresponding session/device.
- Prevent account-existence disclosure.

### Out of Scope

- Registration.
- Verification.
- Refresh-token renewal.
- Password recovery.
- Role-specific business authorization after authentication.

## 3. Actors & Authorization

Primary actor: User.

Login itself is unauthenticated.

After successful login, downstream authorization is handled by CTMS-006 and story-specific business rules.

## 4. Preconditions & Dependencies

Dependencies: CTMS-002.

Successful normal login requires:

- Valid credentials.
- `user.status = active`.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-009 | Login succeeds only when the supplied credentials are valid and user.status = active. A successful login must issue both an access token and a refresh token associated with the corresponding session/device.                                                                                          |
| BR-010 | A failed login must not create a refresh token, session, or other authentication side effect. The response must not reveal whether a given email address or phone number exists in the system.                                                                                                          |
| BR-011 | When creating a new authentication session, users whose status is pending_verification, suspended, or deleted must be denied. Only verification or recovery flows explicitly allowed by policy may proceed. This rule governs only the creation of new authentication sessions.                         |
| BR-170 | Any function requiring authentication may execute only when the user has a valid authenticated session and the account is in active status.                                                                                                                                                             |
| BR-171 | Any function requiring an active account must re-check account status on the backend at request time. pending_verification, suspended, or deleted accounts must be denied even when the client still holds an older access token/session, except for explicitly allowed verification or recovery flows. |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs/API responses must not expose them.                                                                                                                                                                        |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                                                                |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                                                              |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                   |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                            |

## 6. State & Lifecycle

No authenticated session
→ valid credentials + active account
→ authenticated session

Failure:

No authenticated session
→ invalid credentials or disallowed account state
→ no session created

## 7. Business Flow

1. User submits credentials.
2. System resolves and normalizes the login identifier where applicable.
3. System validates credentials.
4. System validates `user.status = active`.
5. System creates the authoritative session/device binding.
6. System issues access and refresh tokens.
7. Client receives authentication outcome and permitted account information.

## 8. Data & Invariants

- Failed login creates no session.
- Failed login creates no refresh token.
- Login response must not disclose whether an email/phone exists.
- `pending_verification`, `suspended`, and `deleted` cannot establish a normal session.
- Authentication secrets must not appear in logs.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                                          |
| ------------------------------ | ---------------------------------------------------------- |
| Unknown email/phone            | Authentication fails without account-existence disclosure. |
| Wrong password                 | Same safe failure principle.                               |
| `pending_verification` account | Reject normal login.                                       |
| `suspended` account            | Reject normal login.                                       |
| `deleted` account              | Reject normal login.                                       |
| Authentication fails midway    | No session/refresh-token side effect.                      |

## 11. Acceptance & Test Matrix

| Source           | Scenario                          | Expected Result                       | Test Type   |
| ---------------- | --------------------------------- | ------------------------------------- | ----------- |
| PB AC-1 / BR-009 | Active user + valid credentials   | Session and tokens created.           | E2E         |
| PB AC-3 / BR-010 | Wrong password                    | Safe failure; no session.             | Integration |
| BR-010           | Unknown account vs wrong password | Response does not disclose existence. | Security    |
| PB AC-4 / BR-011 | Suspended account                 | Login rejected.                       | Integration |
| BR-011           | Pending-verification account      | Login rejected.                       | Integration |
| BR-185           | Inspect logs                      | No password/token leakage.            | Security    |

## 12. Open Decisions

None.

## 13. Extension – Đăng nhập bằng Google (2026-11-21, no Jira key)

Requested by the team (the web "Đăng nhập bằng Google" button existed but did nothing). Decisions made with the user: an unknown Google e-mail creates a **Camper** account; web **and** mobile.

| Item | Behaviour |
| --- | --- |
| API | `POST /api/auth/google` `{ idToken }` → same body as `/auth/login` (accessToken, refreshToken, user). |
| Token check | `google-auth-library` verifies signature, expiry, issuer and audience against `GOOGLE_CLIENT_IDS` (comma-separated; the web OAuth client id). Unverified Google e-mail → 401. Not configured → 503. |
| Matching | Account linked to the Google `sub` (`users.google_sub`, migration `1798300000000`), else the account with the same e-mail. First Google sign-in links the `sub`. An e-mail already linked to a different Google account → 401. |
| Status | `active` → signed in; `pending_verification` → activated (Google proved the e-mail); `suspended`/`deleted` → 401 "Account is not active", no session. |
| New e-mail | Active **Camper** account: name and avatar from Google, phone empty (added later in the profile), random password (use "Quên mật khẩu" to set one). Porter keeps the normal registration (certificate verification). |
| Audit | `auth.register` `{ method: "google", role: "camper" }` for a new account; every sign-in writes `auth.login` `{ method: "google" }`. |
| Web | Google Identity Services button (`VITE_GOOGLE_CLIENT_ID`); hidden when empty. Errors in Vietnamese on the login form. |
| Mobile | `google_sign_in` 7.x, ID token requested for the web client (`--dart-define=GOOGLE_SERVER_CLIENT_ID=…`); button hidden when empty; closing the Google sheet is not an error. Android needs an OAuth **Android** client (package `com.ctms.mobile` + SHA-1) in the same Google Cloud project. |

**Configuration (never commit real values):** `GOOGLE_CLIENT_IDS` (API), `VITE_GOOGLE_CLIENT_ID` (web build arg, also in `docker-compose.yml` / `infra/docker/web.Dockerfile`), `GOOGLE_SERVER_CLIENT_ID` (mobile dart-define). The production workflow must pass `VITE_GOOGLE_CLIENT_ID` as a web build arg and `GOOGLE_CLIENT_IDS` to the API container.

**Tests:** `test/auth.google.integration-spec.ts` (9, Google verifier faked: new Camper, link existing, linked after e-mail change, activate pending, suspended, other Google account, invalid/unverified token, 503, 422); web `LoginPage.google.test.tsx` (3); mobile `test/features/auth/google_login_test.dart` (5).

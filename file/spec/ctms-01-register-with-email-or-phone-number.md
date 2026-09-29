# CTMS-001 — Register with Email or Phone Number

## 1. Overview

Story: CTMS-001

Epic: EPIC 1. Authentication

Use Case: Register with Email or Phone Number

Priority: Must Have

Goal: Allow a new user to create a CTMS account with a unique email or Vietnamese mobile phone number and enter the verification lifecycle.

Backlog story:
As a User, I want to register with email or phone number so I can create a CTMS account.

Acceptance Criteria:

| Source  | Criterion                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | User can register using email or phone number when the submitted data satisfies applicable validation rules.           |
| PB AC-2 | Email and phone uniqueness is enforced after normalization; an existing non-deleted account cannot be duplicated.      |
| PB AC-3 | A successful registration creates the account in `pending_verification`; it does not create an already-active account. |
| PB AC-4 | Password is securely hashed before persistence and raw credentials are never exposed in logs or responses.             |

## 2. Scope

### In Scope

- Register a new account using email or Vietnamese mobile phone number.
- Normalize email and phone before comparison and storage.
- Validate submitted registration data.
- Enforce email/phone uniqueness.
- Hash password before persistence.
- Create the account in `pending_verification`.
- Return an appropriate success or failure outcome.

### Out of Scope

- Account verification; owned by CTMS-002.
- Login; owned by CTMS-003.
- Password recovery; owned by CTMS-005.
- Role-based authorization after login.
- Provider-specific OTP/email delivery implementation.

## 3. Actors & Authorization

Primary actor: User.

Registration is a public authentication entry point and does not require an existing authenticated session.

Backend validation is authoritative.

Client-side validation may improve UX but must not be treated as enforcement.

## 4. Preconditions & Dependencies

Dependencies: None.

Preconditions:

- At least one supported registration identifier is provided.
- Submitted data satisfies the applicable validation rules.
- Normalized email/phone does not already belong to a non-deleted user.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-001 | After normalizing the email address and/or phone number, the system must not create an account if either value already belongs to a non-deleted user. Uniqueness must be enforced by the backend and protected by a database unique constraint or unique index.                                                   |
| BR-002 | For email-based registration, the email address must be trimmed and converted to lowercase before comparison or storage. It must contain no whitespace, exactly one @ character, a valid local part and domain, and must not exceed 254 characters in total.                                                      |
| BR-003 | For registration with a Vietnamese phone number, the system may accept only a 10-digit mobile number beginning with 03, 05, 07, 08, or 09, or the equivalent +84 format. The number must be normalized to E.164 (+84xxxxxxxxx) before comparison or storage.                                                      |
| BR-004 | Passwords must never be stored in plaintext. Before persistence, each password must be hashed using an appropriate salted password-hashing algorithm and configuration. The original password must never be written to application logs, audit logs, or API responses.                                            |
| BR-005 | Registration succeeds only when at least one of email or phone is provided, every supplied field passes validation, uniqueness checks succeed, and the user-creation transaction completes successfully. A newly created account remains in pending_verification status until the verification flow is completed. |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                     |
| BR-184 | Email addresses must be normalized before comparison and storage. Phone numbers must be normalized to a consistent format, preferably E.164.                                                                                                                                                                      |
| BR-185 | Passwords, OTPs, access tokens, and refresh tokens must not be stored as plaintext, and logs/API responses must not expose them.                                                                                                                                                                                  |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                                                                          |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                                                                        |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                             |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                      |

## 6. State & Lifecycle

Primary account lifecycle for this story:

No account
→ registration validation
→ account created
→ `pending_verification`

Invalid or duplicate registration:

No account
→ validation/conflict
→ rejected
→ no account created

CTMS-001 must not activate the account.

Account activation belongs to CTMS-002.

## 7. Business Flow

1. User submits registration data with email or phone number.
2. System normalizes the submitted identifier.
3. System validates registration fields.
4. System checks normalized email/phone uniqueness.
5. Database uniqueness protection remains the final concurrency guard.
6. System hashes the password.
7. System creates the user atomically.
8. New user receives `pending_verification`.
9. User continues to CTMS-002 for verification.

## 8. Data & Invariants

- At least one supported registration identifier is required.
- Normalized identity values are used for uniqueness comparison.
- Raw password must never be persisted.
- Registration must not produce two active records for the same normalized identity.
- Failed registration must not leave a partially created authoritative account.
- Successful registration always enters `pending_verification`.

## 9. API / Integration Contract

TBD — Technical Design.

Technical Design may define endpoints, DTOs, hashing implementation, database indexes, and transaction mechanics.

Technical Design must not change the business behavior defined by this spec without an approved source change.

## 10. Error & Edge Cases

| Case                                                    | Expected Behavior                             |
| ------------------------------------------------------- | --------------------------------------------- |
| Neither email nor phone provided                        | Reject before account creation.               |
| Invalid email format                                    | Reject before persistence.                    |
| Invalid Vietnamese phone format                         | Reject before persistence.                    |
| Email differs only by case/whitespace                   | Normalize before uniqueness comparison.       |
| Phone is equivalent between `0...` and `+84...` formats | Normalize before uniqueness comparison.       |
| Normalized email already exists                         | Reject as business conflict.                  |
| Normalized phone already exists                         | Reject as business conflict.                  |
| Two concurrent requests use the same identity           | At most one authoritative account is created. |
| Password hashing/persistence fails                      | Registration does not report success.         |

## 11. Acceptance & Test Matrix

| Source                    | Scenario                                     | Expected Result                    | Test Type         |
| ------------------------- | -------------------------------------------- | ---------------------------------- | ----------------- |
| PB AC-1 / BR-002 / BR-003 | Register with valid email or phone           | Registration proceeds.             | Integration       |
| PB AC-2 / BR-001          | Register using duplicate normalized identity | Rejected; no duplicate account.    | Integration       |
| PB AC-3 / BR-005          | Valid registration succeeds                  | Account is `pending_verification`. | Integration       |
| PB AC-4 / BR-004          | Inspect persisted credentials                | No plaintext password exists.      | Integration       |
| BR-001                    | Concurrent duplicate registration            | At most one account is created.    | Concurrency / E2E |
| BR-002                    | Invalid email                                | Rejected.                          | Boundary          |
| BR-003                    | Invalid Vietnamese phone                     | Rejected.                          | Boundary          |
| BR-185                    | Inspect logs/responses                       | Raw credentials are absent.        | Security          |

## 12. Open Decisions

None.

# CTMS-009 — Store Important Health Information

## 1. Overview

Story: CTMS-009

Epic: EPIC 1. Authentication

Use Case: Store Important Health Information

Priority: Should Have

Goal: Allow a Camper to store important health information while restricting access to authorized, consented Trip relationships.

Backlog story:
As a Camper, I want to store important health information so an authorized Host or Porter can support me when needed.

Acceptance Criteria:

| Source  | Criterion                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Camper can store important health information under the applicable validation rules.                                    |
| PB AC-2 | Invalid or unauthorized operations do not produce a false successful outcome.                                           |
| PB AC-3 | Only an authorized Host or Porter of a related Trip may view applicable health information, subject to sharing consent. |
| PB AC-4 | Revoking sharing consent terminates server access and invalidates affected offline medical data.                        |

## 2. Scope

### In Scope

- Store/update Camper medical profile information.
- Store sharing-consent state.
- Authorize health-data access.
- Require authorized Trip relationship.
- Minimize returned health information.
- React to consent revocation.
- Invalidate sensitive medical data in offline packages.

### Out of Scope

- General personal-profile data.
- Medical diagnosis or clinical decision-making.
- Defining additional medical fields not present in approved data design.
- General Trip assignment workflows.

## 3. Actors & Authorization

Primary owner: Camper.

Potential readers:

- Host.
- Porter.

Host/Porter access requires both:

1. Valid Camper sharing consent.
2. Authorized relationship to the relevant Trip.

Backend authorization is required on every request.

## 4. Preconditions & Dependencies

Dependencies: CTMS-007.

For Camper update:

- Authenticated Camper owns the target medical profile.

For Host/Porter read:

- Actor is authenticated.
- Actor has an authorized related Trip.
- Camper sharing consent permits access.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-025 | Host or Porter access to user_medical_profiles is allowed only when the user has granted consent and the actor has an authorized business relationship with the relevant Trip. The backend must enforce this authorization on every request.                                                                                                                                        |
| BR-026 | A user may update their medical profile or withdraw sharing_consent at any time. Once consent is withdrawn, all subsequent Host or Porter access requests must be denied immediately.                                                                                                                                                                                               |
| BR-187 | Health-data access must depend on both consent and the relevant Trip relationship. Once consent is withdrawn, access must end immediately.                                                                                                                                                                                                                                          |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                                                                                |
| BR-173 | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                                                                                                                                                   |
| BR-186 | Personal and health data must be returned only as the minimum fields necessary for the business purpose and only to authorized actors.                                                                                                                                                                                                                                              |
| BR-192 | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                                                                                                                            |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |
| BR-230 | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |

## 6. State & Lifecycle

Medical profile:

No profile / existing profile
→ Camper update
→ stored authoritative profile.

Consent:

Consent granted
→ eligible related Host/Porter may receive minimum-necessary health data.

Consent revoked
→ server access denied immediately
→ affected offline sensitive data marked invalid/outdated
→ purge/lock at next sync/connection.

## 7. Business Flow

1. Camper submits supported health information and sharing-consent state.
2. System validates Camper ownership.
3. System persists supported medical information.
4. Host/Porter later requests applicable medical data.
5. Backend validates role.
6. Backend validates related Trip relationship.
7. Backend validates current Camper sharing consent.
8. System returns only minimum-necessary health information.
9. If Camper revokes consent, server access ends immediately.
10. Affected offline medical data is marked invalid/outdated for purge or lock on next sync/connection.

## 8. Data & Invariants

- Camper owns their medical profile.
- Consent alone does not authorize unrelated Host/Porter access.
- Trip relationship alone does not override absent/revoked consent.
- Health-data responses must be minimized.
- Audit logs must not contain unnecessary medical payloads.
- Revoked consent immediately blocks server-side health-data access.

## 9. API / Integration Contract

TBD — Technical Design.

No additional medical fields or consent states are invented by this spec.

## 10. Error & Edge Cases

| Case                                                          | Expected Behavior                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Unrelated Host requests Camper health data                    | Deny.                                                                           |
| Unrelated Porter requests data                                | Deny.                                                                           |
| Related Host/Porter but consent absent                        | Deny.                                                                           |
| Consent revoked immediately before read                       | Deny according to current authoritative consent.                                |
| Audit event generated                                         | Do not copy unnecessary health payload.                                         |
| Offline package contains health data after consent revocation | Mark sensitive portion invalid/outdated and purge/lock at next sync/connection. |

## 11. Acceptance & Test Matrix

| Source           | Scenario                             | Expected Result                                   | Test Type   |
| ---------------- | ------------------------------------ | ------------------------------------------------- | ----------- |
| PB AC-1          | Camper stores supported medical data | Persisted.                                        | Integration |
| PB AC-3 / BR-025 | Related Host/Porter + consent        | Authorized minimum-necessary data available.      | Integration |
| BR-025           | Unrelated Host/Porter                | Access denied.                                    | Security    |
| BR-025           | Related actor without consent        | Access denied.                                    | Security    |
| BR-192           | Inspect audit log                    | Unnecessary health payload absent.                | Security    |
| PB AC-4 / BR-230 | Revoke consent                       | Server access stops immediately.                  | E2E         |
| BR-230           | Existing offline medical data        | Marked invalid/outdated; purge/lock on next sync. | E2E         |

## 12. Open Decisions

BR-026 and BR-187 in the current Business Rules source contain malformed/generated wording and do not define sufficiently precise additional behavior.

They should be corrected in the Business Rules source before additional requirements are derived from them.

# CTMS-007 — Update Personal Profile and Emergency Contact

## 1. Overview

Story: CTMS-007

Epic: EPIC 1. Authentication

Use Case: Update Personal Profile and Emergency Contact

Priority: Must Have

Goal: Allow an authenticated user to maintain permitted personal profile data and emergency contacts.

Backlog story:
As a User, I want to update my personal profile and emergency contacts so my CTMS information remains accurate.

Acceptance Criteria:

| Source  | Criterion                                                                  |
| ------- | -------------------------------------------------------------------------- |
| PB AC-1 | User can update permitted personal-profile information.                    |
| PB AC-2 | Invalid updates do not produce a false successful state.                   |
| PB AC-3 | Valid profile and emergency-contact information is persisted successfully. |
| PB AC-4 | Emergency-contact invariants are enforced.                                 |

## 2. Scope

### In Scope

- Update allowed profile fields.
- Validate profile data.
- Maintain emergency contacts.
- Enforce maximum two emergency contacts.
- Enforce at most one primary contact.
- Normalize supported phone values.
- Minimize personal-data responses.

### Out of Scope

- Medical information; CTMS-009.
- Role management.
- Account registration.

## 3. Actors & Authorization

Primary actor: authenticated User updating their own permitted profile information.

Backend ownership and field-level validation are authoritative.

## 4. Preconditions & Dependencies

Dependencies: CTMS-003.

User must have an authenticated account and permission to update the target profile.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-020 | A user may update only the profile fields that are explicitly editable. All submitted values must be validated, and updated_at must reflect the most recent successful update.                                               |
| BR-021 | emergency_contacts may contain at most two entries. Each entry must include name, phone, relationship, and is_primary according to the schema. When more than one contact exists, no more than one may be marked as primary. |
| BR-022 | Sensitive personal data must be returned on a least-privilege basis for the specific actor and business relationship. The system must not return the full profile when the use case requires only a subset of fields.        |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                         |
| BR-173 | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                            |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                |
| BR-184 | Email addresses must be normalized before comparison and storage. Phone numbers must be normalized to a consistent format, preferably E.164.                                                                                 |
| BR-186 | Personal and health data must be returned only as the minimum fields necessary for the business purpose and only to authorized actors.                                                                                       |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                        |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                 |

## 6. State & Lifecycle

Existing profile
→ valid update
→ updated profile.

Existing emergency contacts
→ valid contact change
→ updated contacts.

Invalid update
→ persisted profile remains unchanged.

## 7. Business Flow

1. Authenticated user submits profile/contact changes.
2. Backend confirms ownership/authorization.
3. System validates only allowed profile fields.
4. System validates and normalizes contact phone data.
5. System enforces maximum two contacts.
6. System enforces at most one primary contact.
7. System commits valid update.
8. `updated_at` changes only after successful update.
9. Response contains only required personal data.

## 8. Data & Invariants

Emergency contact:

- `name` required.
- `phone` required.
- `relationship` required.
- `is_primary` required.
- Maximum two contacts.
- Maximum one primary contact.

Protected/non-allowed profile fields must not be overwritten through this workflow.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                  | Expected Behavior                                 |
| ------------------------------------- | ------------------------------------------------- |
| User updates another user's profile   | Reject.                                           |
| Unsupported/protected field submitted | Must not overwrite protected state.               |
| Third emergency contact               | Reject.                                           |
| Two contacts both primary             | Reject.                                           |
| Invalid contact phone                 | Reject before persistence.                        |
| Persistence fails                     | Existing authoritative profile remains unchanged. |

## 11. Acceptance & Test Matrix

| Source           | Scenario                     | Expected Result                   | Test Type   |
| ---------------- | ---------------------------- | --------------------------------- | ----------- |
| PB AC-1 / BR-020 | Update allowed field         | Persisted successfully.           | Integration |
| BR-020           | Update protected field       | Protected value unchanged.        | Security    |
| BR-021           | Two valid emergency contacts | Accepted.                         | Boundary    |
| BR-021           | Add third contact            | Rejected.                         | Boundary    |
| BR-021           | Two primary contacts         | Rejected.                         | Boundary    |
| BR-022           | Minimal profile response     | Unneeded sensitive fields absent. | Security    |

## 12. Open Decisions

None.

# CTMS-043 — Manage Porter Profile and Route Qualification

## 1. Overview

Story: CTMS-043

Epic: EPIC 7. Porter Management

Use Case: Manage Porter Profile and Route Qualification

Priority: Should Have

Goal: Maintain Porter professional profile and verified Route-specific qualification independently from Host membership or Porter compensation.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| PB AC-1 | Porter manages profile including experience, certifications, languages and availability. |
| PB AC-2 | Porter is an independent actor rather than a Host/location membership record. |
| PB AC-3 | Route qualification is stored per Porter and Route. |
| PB AC-4 | Proficiency uses the approved values learning/proficient/expert. |
| PB AC-5 | `learning` does not qualify Porter as lead. |
| PB AC-6 | Qualification verification is performed only by authorized Route Host/Admin. |
| PB AC-7 | One current qualification record exists per Porter/Route. |
| PB AC-8 | CTMS does not store Porter day-rate/compensation under this story. |

## 2. Scope

### In Scope

- Porter profile.
- Experience.
- Certifications.
- Languages.
- Availability.
- Route qualification.
- Proficiency.
- `times_led`.
- Qualification verification.

### Out of Scope

- Porter wages/day rate.
- Host membership.
- Porter Request.
- Porter Assignment.

## 3. Actors & Authorization

- Porter: manages own profile.
- Host managing relevant Route: verifies qualification where permitted.
- Admin: verifies according to administrative permission.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-006.
- CTMS-013.

Route must exist for Route qualification.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-139 | porter_profiles must store experience_years >= 0, certifications, languages, availability_status, rating_avg, and completed_trips according to schema. Porter Profile is an independent profile belonging to the Porter.                                               |
| BR-140 | A Porter is an independent actor. Collaboration scope with a Host is determined per Trip through Porter Requests and Porter Assignments; no intermediate location-membership resource is maintained.                                                                   |
| BR-152 | Porter Route qualification is managed independently by porter_id + route_id. Only an active Porter with a valid profile may have porter_routes created or updated, subject to the system's verification permissions.                                                   |
| BR-153 | porter_routes.proficiency may be only learning, proficient, or expert. A Porter with learning proficiency is not eligible to act as lead.                                                                                                                              |
| BR-154 | Proficiency verification must store times_led >= 0, verified_by, and verified_at. verified_by must be either an authenticated Host who owns/manages the corresponding Route or an authorized Admin. A Porter may have only one current qualification record per Route. |
| BR-155 | A unique constraint on (porter_id, route_id) must prevent duplicate current proficiency records. Qualification history, if required, must be stored separately.                                                                                                        |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                   |
| BR-173 | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                                      |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                          |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                       |
| BR-183 | Every data relationship must reference an existing, valid record. Child records must not be created for a resource outside the correct business scope.                                                                                                                 |
| BR-186 | Personal and health data must be returned only as the minimum fields necessary for the business purpose and only to authorized actors.                                                                                                                                 |
| BR-189 | A valid time interval requires start_time < end_time. start_time = end_time is allowed only for a business case with an explicit rule permitting it.                                                                                                                   |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                               |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                             |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                  |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                           |

## 6. State & Lifecycle

Profile:
created → updated → current profile.

Qualification:
none → qualification created → verified/current qualification.

Exact archival/history model is Technical Design.

## 7. Business Flow

1. Porter manages own profile.
2. Backend validates identity.
3. Validate experience/languages/certifications/availability.
4. Persist profile.
5. For Route qualification, load Route.
6. Validate `(porter, route)`.
7. Validate proficiency and `times_led`.
8. Verify verifier authority.
9. Store/update current qualification.
10. Record verifier/time.

## 8. Data & Invariants

- `experience_years >= 0`.
- `times_led >= 0`.
- proficiency ∈ approved enum.
- learning is not lead-qualified.
- one current qualification per Porter/Route.
- Porter compensation/day-rate is not stored.
- Porter is not modeled as Host membership.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
| --- | --- |
| Porter edits another profile | Reject. |
| Negative experience | Reject. |
| Invalid proficiency | Reject. |
| learning selected as lead qualification | Not eligible as lead. |
| Unauthorized Host verifies | Reject. |
| Duplicate current qualification | Prevent/update according to authoritative model. |
| day_rate supplied | Not part of CTMS contract. |

## 11. Acceptance & Test Matrix

| Source | Scenario | Expected Result | Test Type |
| --- | --- | --- | --- |
| BR-139 | Valid profile | Persisted | E2E |
| BR-140 | Porter collaboration | No membership dependency | Architecture |
| BR-152 | Route qualification | Correct Porter/Route record | Integration |
| BR-153 | learning Porter | Not lead-qualified | Boundary |
| BR-154 | Authorized Route Host verifies | Accepted | Authorization |
| BR-154 | Unrelated Host verifies | Rejected | Security |
| BR-155 | Duplicate current record | Prevented | Constraint |

## 12. Open Decisions

Exact certification verification model is not defined by this story unless separately specified.
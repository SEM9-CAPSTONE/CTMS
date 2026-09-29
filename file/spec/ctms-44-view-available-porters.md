# CTMS-044 — View Available Porters

## 1. Overview

Story: CTMS-044

Epic: EPIC 7. Porter Management

Use Case: View Available Porters

Priority: Must Have

Goal: Allow Host to identify Porter candidates who are actually eligible and available for a Trip.

Acceptance Criteria:

| Source  | Criterion                                                                                   |
| ------- | ------------------------------------------------------------------------------------------- |
| PB AC-1 | Host can view Porter candidates for a Trip.                                                 |
| PB AC-2 | Only active account/profile Porters are eligible.                                           |
| PB AC-3 | Availability considers current availability status and work-range conflicts.                |
| PB AC-4 | Route qualification is considered when required.                                            |
| PB AC-5 | Experience may be used as an approved filter.                                               |
| PB AC-6 | Availability/qualification/conflict must be revalidated when Request/Assignment is created. |

## 2. Scope

### In Scope

- Candidate list.
- Active profile filter.
- Availability.
- Experience.
- Route qualification.
- Assignment overlap detection.

### Out of Scope

- Porter Request.
- Porter Assignment.
- Porter compensation.

## 3. Actors & Authorization

- Host.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-043.

Trip context must exist when availability is evaluated for a specific Trip.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-141     | The available-Porter list for a Trip must filter by active account/profile status, current availability, experience, assignment conflicts, and Route qualification when the Trip/Route requires qualification under the qualification policy. |
| BR-142     | A Porter with a held or accepted assignment whose work_range overlaps the Trip must not be considered available for the conflicting Trip. The backend must re-check conflicts at request and assignment time.                                 |
| BR-220     | The Porter profile/availability screen may expose only fields required for operations. Eligibility must be computed from profile state, availability, applicable qualification, and assignment conflicts.                                     |
| BR-201     | List-returning APIs must support pagination and enforce a maximum page size. Filtering and sorting are allowed only on documented fields.                                                                                                     |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                         |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                  |

## 6. State & Lifecycle

Read-only candidate evaluation.

A Porter appearing available does not reserve the Porter.

Actual commitment occurs through Request/Assignment workflow.

## 7. Business Flow

1. Host selects Trip.
2. Backend loads Trip schedule/Route.
3. Load active Porter profiles.
4. Apply availability filter.
5. Detect overlapping assignments.
6. Apply Route qualification policy.
7. Apply requested experience filters.
8. Return eligible candidates.
9. Request/Assignment later revalidates eligibility.

## 8. Data & Invariants

- Candidate listing is not a reservation.
- Inactive account/profile is not eligible.
- Overlapping committed assignment makes Porter unavailable.
- Qualification is enforced where Route policy requires it.
- Eligibility must be revalidated before mutation.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                 | Expected Behavior                                 |
| ------------------------------------ | ------------------------------------------------- |
| No available Porter                  | Valid empty list.                                 |
| Porter becomes assigned after search | Request/Assignment revalidation catches conflict. |
| Inactive Porter                      | Excluded.                                         |
| Qualification required but missing   | Excluded.                                         |
| Qualification not required           | Do not invent requirement.                        |

## 11. Acceptance & Test Matrix

| Source | Scenario                            | Expected Result                       | Test Type   |
| ------ | ----------------------------------- | ------------------------------------- | ----------- |
| BR-141 | Active available Porter             | Returned                              | Integration |
| BR-141 | Inactive Porter                     | Excluded                              | Integration |
| BR-142 | Overlapping assignment              | Excluded                              | Boundary    |
| BR-141 | Required qualification missing      | Excluded                              | Integration |
| BR-142 | Availability changes before Request | Revalidation prevents stale selection | Concurrency |

## 12. Open Decisions

Exact sorting/ranking of eligible Porters is not defined by the mapped rules.

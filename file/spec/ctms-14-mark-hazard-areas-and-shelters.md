# CTMS-014 — Mark Hazard Areas and Shelters

## 1. Overview

Story: CTMS-014

Epic: EPIC 2. Trekking Route and Checkpoint Management

Use Case: Mark Hazard Areas and Shelters

Priority: Must Have

Goal: Allow authorized safety information to be attached to a Route for operational and offline use.

Backlog story:
As a Host, I want to mark hazard areas and shelters so trekkers can identify important safety locations.

Acceptance Criteria:

| Source  | Criterion                                                                      |
| ------- | ------------------------------------------------------------------------------ |
| PB AC-1 | Authorized Host can define Route safety features.                              |
| PB AC-2 | Hazard geometry and required safety metadata are validated.                    |
| PB AC-3 | Safety features belong to the correct Route.                                   |
| PB AC-4 | Changes affecting offline safety data can make existing package data outdated. |

## 2. Scope

### In Scope

- Mark hazard areas.
- Mark shelter/safety locations.
- Associate safety features with Route.
- Validate hazard geometry.
- Support severity/description metadata explicitly referenced by source.
- Feed authoritative safety data to offline-package workflows.

### Out of Scope

- Offline package generation.
- Safety-hotspot AI analysis.
- Route creation.

## 3. Actors & Authorization

Primary actor: Host.

Source also references Admin in safety-data context; exact Admin mutation permission must follow approved authorization policy.

## 4. Preconditions & Dependencies

Dependency: CTMS-010.

Route must exist and actor must have authorized scope.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-034 | Checkpoints and hazard areas are shown on the Host/Admin operational map and are consumed by safety and offline features. The system must not expose a public Route browser/detail experience for Campers.        |
| BR-035 | Checkpoint and hazard data required by a Trip must be included in the offline package for the corresponding Route version. When the source Route changes, the previous package must be identifiable as outdated.  |
| BR-036 | Each hazard area must belong to the correct Route and include a Polygon(4326), description, and severity. Each shelter, water, or overnight checkpoint must use the appropriate type and include safety guidance. |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                     |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                             |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                      |

## 6. State & Lifecycle

Route safety data
→ create/update safety feature
→ new authoritative Route safety state.

If already included in an offline package:

Old package safety snapshot
→ Route safety data changes
→ package may become outdated under package-version rules.

## 7. Business Flow

1. Host selects Route.
2. Host marks hazard/shelter safety feature.
3. Backend authorizes actor against Route.
4. Backend validates geometry and supported metadata.
5. Safety feature is persisted.
6. Downstream offline/versioning workflow receives authoritative change as applicable.

## 8. Data & Invariants

Source-supported concepts include:

- Hazard area
- Route
- Polygon
- Description
- Severity
- Shelter
- Water
- Overnight
- Checkpoint

Exact schema remains authoritative in Data Dictionary.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                                | Expected Behavior                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unrelated Host                                      | Reject.                                                                                 |
| Invalid Polygon                                     | Reject.                                                                                 |
| Route missing                                       | Reject.                                                                                 |
| Invalid severity enum                               | Reject according to authoritative enum.                                                 |
| Safety data changed after offline package generated | Package/version workflow must recognize stale data according to approved package rules. |

## 11. Acceptance & Test Matrix

| Source | Scenario                           | Expected Result                                                     | Test Type   |
| ------ | ---------------------------------- | ------------------------------------------------------------------- | ----------- |
| BR-034 | Authorized safety feature creation | Persisted.                                                          | E2E         |
| BR-036 | Invalid hazard Polygon             | Rejected.                                                           | Boundary    |
| BR-174 | Missing required metadata          | Rejected.                                                           | Boundary    |
| BR-035 | Change packaged safety data        | Offline version/staleness behavior triggered as defined downstream. | Integration |

## 12. Open Decisions

BR-034–036 contain generated wording.

Exact distinction between hazard, shelter, water, overnight and checkpoint records must follow the Data Dictionary rather than be inferred here.

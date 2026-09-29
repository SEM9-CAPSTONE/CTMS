# CTMS-011 — Create Checkpoints on Route

## 1. Overview

Story: CTMS-011

Epic: EPIC 2. Trekking Route and Checkpoint Management

Use Case: Create Checkpoints on Route

Priority: Must Have

Goal: Allow an authorized Host to create checkpoints belonging to an existing Trekking Route.

Backlog story:
As a Host, I want to create checkpoints on a trekking route so the route contains operational locations and guidance required by downstream Trip workflows.

Acceptance Criteria:

| Source  | Criterion                                                                                 |
| ------- | ----------------------------------------------------------------------------------------- |
| PB AC-1 | Authorized Host can create checkpoints for an existing Route.                             |
| PB AC-2 | Checkpoint location and required checkpoint information are validated before persistence. |
| PB AC-3 | A Checkpoint must belong to the correct Route/business scope.                             |
| PB AC-4 | Invalid or unrelated checkpoint data does not create a successful Checkpoint.             |

## 2. Scope

### In Scope

- Create Checkpoint under an existing Route.
- Validate Route relationship.
- Validate Checkpoint location.
- Handle supported Checkpoint type.
- Store expected-arrival offset and instruction/guidance where required by the approved data contract.
- Preserve Checkpoint data for downstream navigation/checkpoint-arrival workflows.

### Out of Scope

- Creating the Route itself; CTMS-010.
- Automatic checkpoint-arrival detection; CTMS-061.
- Route approval; CTMS-013.
- Trip waypoint configuration.

## 3. Actors & Authorization

Primary actor: Host.

Backend must verify that the Host is authorized to modify the target Route.

A valid Host role alone does not authorize changes to an unrelated Route.

## 4. Preconditions & Dependencies

Dependencies: CTMS-010.

Preconditions:

- Route exists.
- Actor is authenticated.
- Actor is authorized for the Route.
- Route is in a state that permits checkpoint configuration.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-028 | A Checkpoint must belong to an existing Route and must include location as Point(4326), a valid checkpoint_type, expected_arrival_offset >= 0, and instruction/guidance. In V3, the safety radius is fixed at 20 m. If the schema stores radius_m, it must equal 20 and no alternative configuration may change the CHECKPOINT_REACHED threshold. A Checkpoint referencing a different Route must be rejected. |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                  |
| BR-183 | Every data relationship must reference an existing, valid record. Child records must not be created for a resource outside the correct business scope.                                                                                                                                                                                                                                                         |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                                                                                                                         |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                          |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                   |

## 6. State & Lifecycle

No Checkpoint
→ valid creation
→ Checkpoint persisted under Route.

Invalid/unauthorized request
→ no Checkpoint created.

This story does not define `CHECKPOINT_REACHED`; it only provides Checkpoint data used by that downstream workflow.

## 7. Business Flow

1. Host selects an existing Route.
2. Host submits Checkpoint information.
3. Backend authenticates and authorizes Host against Route.
4. Backend validates Checkpoint fields and location.
5. Backend validates Route relationship.
6. Backend persists Checkpoint atomically.
7. Checkpoint becomes part of the Route's operational definition.

## 8. Data & Invariants

Source-supported Checkpoint concepts include:

- Route reference
- `location`
- Point geometry
- `type` / `checkpoint_type`
- `expected_arrival_offset`
- `instruction`
- `guidance`

Invariants:

- Checkpoint cannot belong to an unrelated Route.
- Invalid location must not be persisted.
- Failed creation leaves no partial Checkpoint.

## 9. API / Integration Contract

TBD — Technical Design.

Exact DTO, coordinate representation and Checkpoint enum are not invented here.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                       |
| --------------------------------------- | --------------------------------------- |
| Route does not exist                    | Reject.                                 |
| Host does not own/have scope over Route | Reject.                                 |
| Invalid Point/location                  | Reject.                                 |
| Invalid Checkpoint type                 | Reject according to authoritative enum. |
| Stale/deleted Route reference           | Reject.                                 |
| Persistence fails                       | No partial Checkpoint.                  |

## 11. Acceptance & Test Matrix

| Source           | Scenario                              | Expected Result       | Test Type |
| ---------------- | ------------------------------------- | --------------------- | --------- |
| PB AC-1 / BR-028 | Valid Checkpoint on authorized Route  | Created successfully. | E2E       |
| BR-183           | Checkpoint references unrelated Route | Rejected.             | Security  |
| BR-174           | Missing required data                 | Rejected.             | Boundary  |
| BR-028           | Invalid Point geometry                | Rejected.             | Boundary  |
| BR-188           | Invalid expected-arrival timing data  | Rejected.             | Boundary  |

## 12. Open Decisions

BR-028 currently contains generated wording.

The exact `checkpoint_type` enum, Point-coordinate contract and constraints on `expected_arrival_offset` must come from the approved Data Dictionary/Technical Design rather than being invented here.

# CTMS-010 — Create Trekking Route on Map

## 1. Overview

Story: CTMS-010

Epic: EPIC 2. Trekking Route and Checkpoint Management

Use Case: Create Trekking Route on Map

Priority: Must Have

Goal: Allow an authorized Host to create an internal Trekking Route with valid ownership and route geometry for downstream route-management workflows.

Backlog story:
As a Host, I want to create a trekking route on a map so I can define the route used by later checkpoint, approval, and Trip workflows.

Acceptance Criteria:

| Source  | Criterion                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Authorized Host can create a Trekking Route using supported route data.                                                        |
| PB AC-2 | Unauthorized or invalid route creation does not produce a successful route.                                                    |
| PB AC-3 | Route ownership and referenced data are validated by the backend.                                                              |
| PB AC-4 | Created Route remains an internal operational resource rather than becoming Camper-public content merely because it is active. |

## 2. Scope

### In Scope

- Authorize Host route creation.
- Validate Host/business scope.
- Validate required route fields.
- Persist route geometry.
- Persist start location.
- Create internal Trekking Route resource.

### Out of Scope

- Creating checkpoints; downstream story.
- Route approval.
- Hazard/shelter management.
- Trip creation.
- Camper public route browsing.
- Automatic duration calculation unless defined by another approved story/source.

## 3. Actors & Authorization

Primary actor: Host.

Host must be authenticated and authorized to create the Route within the relevant business scope.

Backend authorization is authoritative.

## 4. Preconditions & Dependencies

Dependencies: CTMS-006.

Preconditions:

- Host is authenticated.
- Host is authorized for the target business scope.
- Referenced records exist.
- Required route data is valid.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-027 | A Trekking Route is owned by a Host through route.host_id and must store, at minimum, name, route_geom as LineString(4326), start_location, end_location, distance_km > 0, difficulty, estimated_duration > 0, porter_required, version, and status. Route-management authorization must be based on route.host_id. |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                       |
| BR-183 | Every data relationship must reference an existing, valid record. Child records must not be created for a resource outside the correct business scope.                                                                                                                                                              |
| BR-188 | Absolute timestamps must be stored as timestamptz. Pure calendar dates use date, and time-of-day values use time where defined by schema. APIs must transmit timezone/offset explicitly, and the UI must display values using the configured timezone.                                                              |
| BR-199 | APIs must use consistent error semantics: 401 for authentication failures, 403 for insufficient authorization, 404 for not found, 409 for business conflicts, and 422 for invalid input.                                                                                                                            |
| BR-200 | Error messages must clearly describe the problem and the user action required, while never exposing stack traces, secrets, or resources the user is not authorized to see.                                                                                                                                          |
| BR-202 | List/public endpoints may return only resources in states permitted for public exposure. Route is an internal operational resource and must not provide Camper-facing public browse/detail access even when route.status = active.                                                                                  |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                               |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                        |

## 6. State & Lifecycle

No Route
→ authorized valid creation
→ internal Trekking Route created.

Invalid/unauthorized creation:
No Route
→ rejected
→ no Route created.

This story does not define route approval/publication lifecycle.

## 7. Business Flow

1. Host opens route creation.
2. Host provides supported route metadata and map geometry.
3. Backend authenticates Host.
4. Backend authorizes Host/business scope.
5. Backend validates referenced records.
6. Backend validates required route fields.
7. Backend validates `route_geom` according to the supported LineString contract.
8. System persists the Route atomically.
9. Route becomes available to downstream internal checkpoint/approval workflows.
10. Route is not exposed as Camper-public browse/detail solely because its status is active.

## 8. Data & Invariants

Concrete data concepts supported by the mapped source include:

- `route.host_id`
- `name`
- `route_geom`
- LineString geometry
- `start_location`

Invariants:

- Route belongs to an authorized Host/business scope.
- Referenced records must exist.
- Invalid geometry must not be persisted as a successful Route.
- Failed creation leaves no partially created authoritative Route.
- Route remains an internal operational resource.

## 9. API / Integration Contract

TBD — Technical Design.

Technical Design may define:

- Map provider.
- Geometry DTO.
- Coordinate representation.
- Endpoint.
- Persistence type.
- Geometry validation implementation.

These technical choices must not introduce new business requirements without an approved source.

## 10. Error & Edge Cases

| Case                                                      | Expected Behavior                                   |
| --------------------------------------------------------- | --------------------------------------------------- |
| Non-Host attempts creation                                | Reject.                                             |
| Host lacks business scope                                 | Reject.                                             |
| Invalid `host_id` relationship                            | Reject.                                             |
| Required route field missing                              | Reject before persistence.                          |
| `route_geom` invalid                                      | Reject.                                             |
| Unsupported geometry type                                 | Reject.                                             |
| Persistence fails                                         | No successful Route state.                          |
| Client requests Route through Camper-public browse/detail | Do not expose Route as public content under BR-202. |

## 11. Acceptance & Test Matrix

| Source           | Scenario                                     | Expected Result                                    | Test Type   |
| ---------------- | -------------------------------------------- | -------------------------------------------------- | ----------- |
| PB AC-1 / BR-027 | Authorized Host + valid route data           | Route created.                                     | E2E         |
| PB AC-2 / BR-172 | Unauthorized actor                           | Rejected; no Route created.                        | Security    |
| BR-174           | Missing required route data                  | Rejected before persistence.                       | Boundary    |
| BR-183           | Invalid Host/business relationship           | Rejected.                                          | Integration |
| BR-027           | Invalid/non-LineString route geometry        | Rejected according to supported geometry contract. | Boundary    |
| PB AC-4 / BR-202 | Query Route from Camper-public browse/detail | Route not publicly exposed.                        | Integration |

## 12. Open Decisions

BR-027 in the current Business Rules source contains malformed/generated wording.

The source clearly identifies `route.host_id`, Host, `name`, `route_geom`, LineString and `start_location`, so those concepts are retained.

The source does not support inventing:

- minimum/maximum route distance;
- minimum number of route points;
- automatic duration calculation;
- elevation constraints;
- route self-intersection policy;
- map provider;
- coordinate precision.

Those remain outside this spec until defined by an approved Business Rule, PB AC, or Technical Design where technically appropriate.

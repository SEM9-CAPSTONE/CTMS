# CTMS-052 — Create Offline Package for Each Trip

## 1. Overview

Story: CTMS-052

Epic: EPIC 8. Offline Package

Use Case: Create Offline Package for Each Trip

Priority: Must Have

Goal: Build a versioned Offline Safety Package for a published Trip containing the authoritative data required for offline operation.

## 2. Scope

### In Scope
- Package generation.
- Route geometry/version.
- Checkpoints.
- Hazard areas.
- Required Trip waypoints.
- Safety guidance.
- Package metadata/version/checksum.
- Sensitive-data consent handling.

### Out of Scope
- Package download — CTMS-053.
- Integrity verification on device — CTMS-054.
- Offline rendering — CTMS-055.
- GPS tracking.

## 3. Actors & Authorization

- System.
- Authorized Trip context.

## 4. Preconditions & Dependencies

Trip must be `published`.

Required Route/Trip/safety sources must exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-229 | An Offline Safety Package may be generated only for a published Trip and must contain, at minimum, Route geometry/version, checkpoints, route_hazard_areas, required Trip waypoints, safety instructions/guidance, and sufficient metadata/checksum/version information for the client to identify the exact safety dataset in use.                                                 |
| BR-230 | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |
| BR-365 | An Offline Safety Package used for safety must contain all data needed for local detection within the enabled feature scope, including at minimum the applicable Route geometry, monitored Checkpoints, required hazard/safety metadata, and package metadata/version. The client must not depend on the server to read this data while offline.                                    |
| BR-428 | Package generation must accurately snapshot or reference the versions of all required authoritative inputs. Storing only a generic package version is insufficient if it does not allow the exact Route, Checkpoint, and hazard state included in the package to be identified for audit.                                                                                           |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |

## 6. State & Lifecycle

Published Trip
→ package generation
→ package version available.

A later authoritative safety-source change may make a downloaded package outdated.

Important V3 invariant:

- Trip already started continues using the package version activated at Start Trip.
- Trip not started must load/validate/activate the required newer version according to version policy.

## 7. Business Flow

1. Verify Trip is published.
2. Resolve authoritative Route/version.
3. Load checkpoints.
4. Load hazard areas.
5. Load required Trip waypoints.
6. Load approved safety/survival guidance.
7. Include only sensitive data currently permitted.
8. Generate package version and metadata.
9. Generate checksum.
10. Persist/package artifact.
11. Make package available for authorized download.

## 8. Data & Invariants

Package identifies:
- Trip;
- Route/version;
- package version;
- required safety data;
- checksum;
- generation/update metadata.

A package must identify exactly which safety dataset it represents.

Sensitive information cannot remain authorized merely because it was downloaded earlier.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected |
| --- | --- |
| Trip not published | Do not generate package. |
| Route version missing | Fail generation. |
| Required safety data incomplete | Do not falsely mark complete. |
| Consent revoked | Sensitive section becomes invalid/outdated. |
| New version after Trip started | Do not hot-update active ongoing Trip package. |

## 11. Acceptance & Test Matrix

| Scenario | Expected |
| --- | --- |
| Published Trip | Package can be generated |
| Non-published Trip | Rejected |
| Inspect package | Required safety components present |
| Check metadata | Version/checksum present |
| Consent revoked | Sensitive data invalidated |
| Started Trip on v5, v6 released | Trip remains on activated v5 |
| Not-started Trip requires v6 | Must validate/activate v6 |

## 12. Open Decisions

Physical package format, compression and storage mechanism belong to Technical Design.
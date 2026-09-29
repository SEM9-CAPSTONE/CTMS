# CTMS-119 — Publish New Offline Safety Package Version after Safety Update

## 1. Overview

Story: CTMS-119

Epic: EPIC 8. Offline Package

Use Case: Publish New Offline Safety Package Version after Safety Update

Priority: Must Have

Goal: Publish a new immutable Offline Safety Package version whenever an authoritative safety change affects package content, while preserving historical package/version traceability.

Backlog story: As the System, I want to publish a new Offline Safety Package version after a safety update so future Trips use updated safety data without rewriting historical package evidence.

Acceptance Criteria:

| Source  | Criterion                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Package-affecting authoritative safety change creates a new package version.                                                          |
| PB AC-2 | Previously published package is never modified in place.                                                                              |
| PB AC-3 | New package is built from current authoritative Route/safety data.                                                                    |
| PB AC-4 | Package must pass applicable generation/integrity/version validation before publication.                                              |
| PB AC-5 | Publication preserves version history and traceability to the safety update.                                                          |
| PB AC-6 | Existing Trip/session historical package references remain valid.                                                                     |
| PB AC-7 | Clients/Trips can determine when their package is outdated and obtain the applicable newer version according to package-update rules. |

## 2. Scope

### In Scope

- New package version generation.
- Package validation.
- Publication.
- Historical version preservation.
- Safety-update traceability.
- Outdated-package relationship.

### Out of Scope

- Editing a published package.
- Rewriting package version used by an already-recorded historical GPS/safety event.
- Hotspot detection/review.

## 3. Actors & Authorization

Primary actors:

- System package-generation process.
- Authorized publication process where approval is required.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-052.
- CTMS-057.
- CTMS-118.

An authoritative safety change affects Offline Safety Package content.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-359 | When authoritative Route geometry, Route Checkpoints, route_hazard_areas, or safety instructions change in a way that affects the Offline Safety Package, the system must create a new package version. A published package must not be modified in place.                                                                          |
| BR-427 | When a new Offline Safety Package version is published, a Trip that has not started must download, validate, and activate the new version before deleting the old package. An ongoing Trip must continue using the package that was locked at Trip start and must not hot-update in V3.                                             |
| BR-428 | Package generation must accurately snapshot or reference the versions of all required authoritative inputs. Storing only a generic package version is insufficient if it does not allow the exact Route, Checkpoint, and hazard state included in the package to be identified for audit.                                           |
| BR-429 | For a future Trip preparing to download its package, package version resolution must follow a consistent server-side policy. The client must not arbitrarily select an older package if that package has been revoked or is no longer valid.                                                                                        |
| BR-430 | If an Offline Safety Package is revoked because of a critical safety issue, the system must store the revocation status and metadata. A Trip that has not started must resolve to a new valid package version before departure. An ongoing Trip must continue using the package locked at Trip start and must not hot-update in V3. |
| BR-360 | The Trip/client must be able to identify the package version used when GPS or safety data is recorded. GPS logs, safety events, and sync payloads must carry enough reference/version context for historical analysis to reconstruct the safety data that was in effect at event time.                                              |
| BR-191 | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                                                                                |

## 6. State & Lifecycle

Authoritative safety update
→ package impact detected
→ new package version generated
→ validated
→ published.

Existing published version remains immutable.

Conceptually:

`vN published`

- safety update
  → `vN+1 generated`
  → `vN+1 validated`
  → `vN+1 published`

`vN` remains historical evidence.

## 7. Business Flow

1. Authoritative safety update is committed.
2. Determine whether Offline Safety Package content is affected.
3. If unaffected, no package version is created solely for this story.
4. If affected, create new package version.
5. Build package from current authoritative safety data.
6. Calculate/validate applicable integrity metadata.
7. Validate package/version.
8. Publish new version.
9. Preserve previous published versions.
10. Link new package to triggering safety update/version context.
11. Allow applicable Trip/client to identify outdated package and obtain newer version according to update policy.

## 8. Data & Invariants

New package retains applicable:

- package ID;
- version;
- source Route/version;
- safety-data/version context;
- integrity/checksum metadata;
- generated/published time;
- triggering safety update reference.

Invariants:

- published package is immutable;
- new safety content means new version when package content is affected;
- historical GPS/safety events continue referencing the package actually used;
- publication of vN+1 does not rewrite vN.

For an ongoing Trip, active package behavior continues to follow the approved package activation/version rules rather than silently replacing the package used by the safety session.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                         | Expected Behavior                              |
| -------------------------------------------- | ---------------------------------------------- |
| Safety update does not affect package        | No unnecessary version required by this rule   |
| Safety update affects package                | Generate new version                           |
| Attempt to modify published package          | Reject                                         |
| New package fails integrity validation       | Do not publish                                 |
| v5 historical GPS exists and v6 is published | Historical event remains linked to v5          |
| Client has older applicable package          | Identify as outdated according to update rules |
| Package generation retried                   | Must not corrupt/version history               |

## 11. Acceptance & Test Matrix

| Source | Scenario                        | Expected Result                     | Test Type    |
| ------ | ------------------------------- | ----------------------------------- | ------------ |
| BR-359 | Package-affecting safety update | New version created                 | Integration  |
| BR-359 | Edit existing published version | Rejected                            | Integrity    |
| BR-428 | Invalid generated package       | Not published                       | Validation   |
| BR-429 | Publish new package             | Version history preserved           | Data         |
| BR-360 | Historical safety event         | Original package reference retained | Traceability |
| BR-430 | Older applicable client package | Update/outdated state identifiable  | E2E          |
| BR-191 | Publication                     | Audited                             | Audit        |

## 12. Open Decisions

None for the core versioning rule: package-affecting authoritative safety updates require a new package version and published packages are not edited in place.

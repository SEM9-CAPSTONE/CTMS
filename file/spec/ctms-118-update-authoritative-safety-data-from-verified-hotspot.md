# CTMS-118 — Update Authoritative Safety Data from Verified Hotspot

## 1. Overview

Story: CTMS-118

Epic: EPIC 2. Trekking Route and Checkpoint Management

Use Case: Update Authoritative Safety Data from Verified Hotspot

Priority: Must Have

Goal: Allow authorized, validated corrective changes to authoritative Route/safety data only after the supporting PotentialSafetyHotspot has been confirmed.

Backlog story: As an authorized user, I want to update authoritative safety data from a verified hotspot so confirmed safety findings can improve future Trip safety information.

Acceptance Criteria:

| Source  | Criterion                                                                            |
| ------- | ------------------------------------------------------------------------------------ |
| PB AC-1 | Corrective action may use only a `CONFIRMED` PotentialSafetyHotspot.                 |
| PB AC-2 | Corrective action requires normal authorization and validation.                      |
| PB AC-3 | Analytics/AI cannot directly perform authoritative safety modification.              |
| PB AC-4 | Applicable Route geometry/checkpoint/hazard/safety-instruction change is auditable.  |
| PB AC-5 | If change affects Offline Safety Package content, a new package version is required. |
| PB AC-6 | Published package is not modified in place.                                          |

## 2. Scope

### In Scope

Authorized corrective changes to applicable:

- Route geometry;
- Route Checkpoint;
- route_hazard_areas;
- safety instruction.

### Out of Scope

- Automatic AI modification.
- Editing published Offline Safety Package in place.
- Package publication itself — CTMS-119.

## 3. Actors & Authorization

Primary actor:

- Authorized Route/safety administrator or other authorized actor defined by current permissions.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-117.

PotentialSafetyHotspot status = `CONFIRMED`.

## 5. Business Rules

| BR             | Rule                                                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-358         | Only a PotentialSafetyHotspot with status = CONFIRMED may be used as the basis for proposing corrective action to authoritative safety data. Any corrective action must pass the existing authorization and validation rules.                                              |
| BR-359         | When authoritative Route geometry, Route Checkpoints, route_hazard_areas, or safety instructions change in a way that affects the Offline Safety Package, the system must create a new package version. A published package must not be modified in place.                 |
| BR-356         | AI/analytics must not automatically modify Route geometry, checkpoints, route_hazard_areas, or safety instructions based on GPS patterns. Analysis results may only create suggestions/candidates for verification by an authorized person.                                |
| BR-419         | Any corrective action taken from a CONFIRMED PotentialSafetyHotspot must retain a link to the hotspot and to the evidence/review decision that justified the change to authoritative safety data.                                                                          |
| BR-423         | A CONFIRMED hotspot does not automatically require a Route geometry change. The reviewer must select an appropriate corrective-action type, or explicitly record a no-data-change/other action together with the reason.                                                   |
| BR-426         | Updates to authoritative Route geometry, Checkpoints, or hazards must use the existing Route module's validation and authorization rules. Safety analytics must not bypass Route publish/edit controls.                                                                    |
| BR-361         | Safety statistics and hotspot aggregates may be retained longer than raw GPS data, but they must minimize personal data, enforce authorization, and must not expose raw member locations to Hosts/Admins outside authorized operational, safety-review, or audit purposes. |
| BR-191         | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                       |

## 6. State & Lifecycle

CONFIRMED hotspot
→ corrective action proposed
→ authorization/validation
→ authoritative safety data changed
→ package-impact evaluation
→ new package version required when applicable.

## 7. Business Flow

1. Open CONFIRMED hotspot.
2. Review confirmed evidence.
3. Propose corrective safety change.
4. Verify authorization.
5. Validate target Route/safety data.
6. Apply authoritative change transactionally.
7. Audit before/after/reason.
8. Determine Offline Safety Package impact.
9. If affected, trigger new package-version flow.

## 8. Data & Invariants

Confirmed hotspot is evidence, not permission to bypass Route rules.

Authoritative changes must retain traceability to:

- hotspot;
- actor;
- affected safety entity;
- before/after;
- timestamp/reason.

Published package content remains immutable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                | Expected Behavior           |
| ----------------------------------- | --------------------------- |
| DETECTED hotspot                    | Cannot drive correction     |
| UNDER_REVIEW hotspot                | Cannot drive correction     |
| DISMISSED hotspot                   | Cannot drive correction     |
| CONFIRMED + unauthorized actor      | Reject                      |
| CONFIRMED + valid authorized change | Apply                       |
| Package-affecting change            | Require new package version |
| AI attempts direct Route update     | Reject                      |

## 11. Acceptance & Test Matrix

| Source | Scenario                    | Expected Result      | Test Type     |
| ------ | --------------------------- | -------------------- | ------------- |
| BR-358 | CONFIRMED hotspot           | Eligible evidence    | Integration   |
| BR-358 | Non-confirmed hotspot       | Reject correction    | Safety        |
| BR-356 | AI mutation                 | Rejected             | Authorization |
| BR-359 | Safety data affects package | New version required | Integration   |
| BR-191 | Authoritative change        | Audited              | Audit         |

## 12. Open Decisions

The exact corrective action depends on confirmed evidence; this story does not require every hotspot to modify Route geometry specifically.

# CTMS-117 — Review Potential Safety Hotspots

## 1. Overview

Story: CTMS-117

Epic: EPIC 18. Administration and Audit

Use Case: Review Potential Safety Hotspots

Priority: Must Have

Goal: Require authorized human review before a detected PotentialSafetyHotspot can become confirmed safety evidence.

Backlog story: As an authorized Admin/Host, I want to review potential safety hotspots so analytics findings are verified before authoritative safety data is changed.

Acceptance Criteria:

| Source  | Criterion                                                                                     |
| ------- | --------------------------------------------------------------------------------------------- |
| PB AC-1 | PotentialSafetyHotspot follows `DETECTED → UNDER_REVIEW → CONFIRMED or DISMISSED`.            |
| PB AC-2 | Only authorized Admin/Host may review applicable evidence.                                    |
| PB AC-3 | AI/analytics cannot self-confirm a hotspot.                                                   |
| PB AC-4 | Review decision and evidence are auditable.                                                   |
| PB AC-5 | Only `CONFIRMED` hotspot may support proposed corrective action to authoritative safety data. |

## 2. Scope

### In Scope

- Hotspot review.
- Evidence inspection.
- Confirm.
- Dismiss.
- Audit.

### Out of Scope

- Direct Route/safety modification — CTMS-118.
- AI self-confirmation.

## 3. Actors & Authorization

Actors:

- Authorized Admin.
- Authorized Host where permitted.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-116.

PotentialSafetyHotspot exists.

## 5. Business Rules

| BR             | Rule                                                                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-357         | PotentialSafetyHotspot follows the lifecycle DETECTED → UNDER_REVIEW → CONFIRMED or DISMISSED. Authorized Admins/Hosts may review the evidence; analytics/AI must not self-CONFIRM a hotspot or directly modify authoritative Route/safety data.                           |
| BR-358         | Only a PotentialSafetyHotspot with status = CONFIRMED may be used as the basis for proposing corrective action to authoritative safety data. Any corrective action must pass the existing authorization and validation rules.                                              |
| BR-361         | Safety statistics and hotspot aggregates may be retained longer than raw GPS data, but they must minimize personal data, enforce authorization, and must not expose raw member locations to Hosts/Admins outside authorized operational, safety-review, or audit purposes. |
| BR-423         | A CONFIRMED hotspot does not automatically require a Route geometry change. The reviewer must select an appropriate corrective-action type, or explicitly record a no-data-change/other action together with the reason.                                                   |
| BR-424         | Every hotspot-review action must record, at minimum, actor, action, timestamp, previous status, new status, and reason/comment. Changes to evidence or corrective actions must remain traceable.                                                                           |
| BR-425         | A Host may review or confirm a hotspot only for Routes/Trips within that Host's management scope and only when role policy permits it. Admins may have cross-system authority according to RBAC. The client must not self-authorize by supplying a route_id.               |
| BR-191         | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                       |

## 6. State & Lifecycle

`DETECTED`
→ `UNDER_REVIEW`
→ `CONFIRMED`

or

`DETECTED`
→ `UNDER_REVIEW`
→ `DISMISSED`

## 7. Business Flow

1. Authorized reviewer opens detected hotspot.
2. Verify authorization.
3. Transition to UNDER_REVIEW when applicable.
4. Review supporting deviation evidence.
5. Decide CONFIRMED or DISMISSED.
6. Persist reviewer/decision/evidence context.
7. Audit transition.
8. Only CONFIRMED candidate proceeds to CTMS-118.

## 8. Data & Invariants

AI/analytics cannot set CONFIRMED.

DISMISSED candidate cannot be treated as authoritative safety evidence.

Review does not itself modify Route safety data.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior                       |
| ------------------------ | --------------------------------------- |
| AI attempts CONFIRMED    | Reject                                  |
| Unauthorized reviewer    | Reject                                  |
| Valid human confirmation | CONFIRMED                               |
| Evidence rejected        | DISMISSED                               |
| Invalid transition       | Reject                                  |
| CONFIRMED                | Eligible for corrective-action proposal |

## 11. Acceptance & Test Matrix

| Source | Scenario                                  | Expected Result | Test Type |
| ------ | ----------------------------------------- | --------------- | --------- |
| BR-357 | DETECTED → UNDER_REVIEW                   | Accepted        | State     |
| BR-357 | Human confirms                            | CONFIRMED       | E2E       |
| BR-357 | AI confirms                               | Rejected        | Safety    |
| BR-357 | Dismiss                                   | DISMISSED       | State     |
| BR-358 | Non-confirmed hotspot used for correction | Reject          | Integrity |
| BR-191 | Decision                                  | Audited         | Audit     |

## 12. Open Decisions

None for the approved hotspot lifecycle.

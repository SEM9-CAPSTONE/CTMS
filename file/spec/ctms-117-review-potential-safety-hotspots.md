# CTMS-117 — Review Potential Safety Hotspots

## CTMS-052 dependency clarification — 2026-11-06

This is the GPS-derived hotspot pipeline. Its `CONFIRMED PotentialSafetyHotspot` is separate from Host verification of an individual CTMS-049 incident. CTMS-118 begins with a CONFIRMED hotspot and retains all authorization/corrective-action controls; it does not confirm an Incident or automatically promote a field report. See [separate upstream tasks](ctms-52-upstream-safety-contracts.md). Acceptance: an unverified incident or a non-CONFIRMED hotspot cannot enter authoritative package hazard input through this pipeline.

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
| PB AC-1 | Detection creates PotentialSafetyHotspot directly in `UNDER_REVIEW`; Admin can decide `CONFIRMED` or `DISMISSED`. Legacy `DETECTED` records remain reviewable. |
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
| BR-357         | Detection creates PotentialSafetyHotspot in UNDER_REVIEW. Admin may decide CONFIRMED or DISMISSED directly. Legacy DETECTED records remain reviewable. Authorized reviewers inspect evidence; analytics/AI must not self-CONFIRM or modify authoritative safety data. |
| BR-358         | Only a PotentialSafetyHotspot with status = CONFIRMED may be used as the basis for proposing corrective action to authoritative safety data. Any corrective action must pass the existing authorization and validation rules.                                              |
| BR-361         | Safety statistics and hotspot aggregates may be retained longer than raw GPS data, but they must minimize personal data, enforce authorization, and must not expose raw member locations to Hosts/Admins outside authorized operational, safety-review, or audit purposes. |
| BR-423         | A CONFIRMED hotspot does not automatically require a Route geometry change. The reviewer must select an appropriate corrective-action type, or explicitly record a no-data-change/other action together with the reason.                                                   |
| BR-424         | Every hotspot-review action must record, at minimum, actor, action, timestamp, previous status, new status, and reason/comment. Changes to evidence or corrective actions must remain traceable.                                                                           |
| BR-425         | A Host may review or confirm a hotspot only for Routes/Trips within that Host's management scope and only when role policy permits it. Admins may have cross-system authority according to RBAC. The client must not self-authorize by supplying a route_id.               |
| BR-191         | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                       |

## 6. State & Lifecycle

`UNDER_REVIEW`
→ `CONFIRMED`

or

`UNDER_REVIEW`
→ `DISMISSED`

Legacy `DETECTED` and current `UNDER_REVIEW` records may transition directly to `CONFIRMED` or `DISMISSED`.

## 7. Business Flow

1. Authorized reviewer opens detected hotspot.
2. Verify authorization.
3. Offer CONFIRMED or DISMISSED immediately, without an intermediate status change.
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
| BR-357 | New detection starts UNDER_REVIEW          | Accepted        | State     |
| BR-357 | UNDER_REVIEW → CONFIRMED or DISMISSED      | Accepted        | State     |
| BR-357 | Legacy DETECTED → either decision         | Accepted        | State     |
| BR-357 | Request targets UNDER_REVIEW              | Rejected        | Validation |
| BR-357 | Human confirms                            | CONFIRMED       | E2E       |
| BR-357 | AI confirms                               | Rejected        | Safety    |
| BR-357 | Dismiss                                   | DISMISSED       | State     |
| BR-358 | Non-confirmed hotspot used for correction | Reject          | Integrity |
| BR-191 | Decision                                  | Audited         | Audit     |

## 12. Open Decisions

None for the approved hotspot lifecycle.

## Porter danger-zone reporting amendment — 2026-11-21

New manual danger-zone proposals are submitted by the assigned Porter from the mobile
**Chuyến đi → Báo điểm nguy hiểm** form. Host creation is removed: the Host
`POST /api/trekking-routes/:routeId/danger-zone-proposals` and the direct
`POST /api/trekking-routes/:routeId/hazard-areas` no longer exist, and the web route
screens no longer offer drawing or proposing danger zones. Owned-Route history
(`GET` on both paths) and existing Host/incident records remain available; Admin
corrective hazard areas from approvals and safety hotspots are unchanged.

`POST /api/trips/:tripId/danger-zone-proposals` accepts `clientRequestId`, `hazardType`,
`severity`, `description` (1–1000 characters), `observedAt`, and required `location`
(`latitude`, `longitude`, `accuracyMeters`, `capturedAt`). The Route comes from the Trip.
GPS must be within 30 seconds of the observation; future timestamps beyond 30 seconds
are rejected. The initial radius is a fixed 5 m point; GPS accuracy is kept for review only.
An account-scoped request key returns the same proposal on identical retries and 409
for changed evidence. `GET` on the same path lists only that Porter's proposals.

The form is available during an ongoing Trip. Persisted reports may arrive after completion
if observed during the actual operating window (scheduled timestamps are the legacy
fallback). Delivery still requires the Porter to be assigned. Synchronization never
replaces the saved coordinates or observation time with the current position.

Mobile saves the full report durably before sending and retains it across restarts.
The existing reconnection coordinator sends pending work while the app is active,
on reconnection and resume. Transient errors use bounded exponential backoff; invalid
or unauthorized reports stop automatic retries and show a Vietnamese explanation.
Logout cancels requests and isolates the saved queue by account. No killed-app background
execution is promised. Admin sees source **Porter**, reporter, Trip, capture time and GPS
accuracy in the existing proposal review screen. Only approval publishes a verified zone.

Field photos are optional: up to 3 JPEG/PNG/WebP images of at most 5 MB each.
`POST /api/trips/:tripId/danger-zone-proposals/:proposalId/photos` (multipart `file`)
accepts one photo for the Porter's own pending report; the content hash makes a retried
upload return the stored photo instead of counting twice. Decided reports reject new photos
(409 `PROPOSAL_ALREADY_DECIDED`), a fourth photo returns 409 `PROPOSAL_PHOTO_LIMIT`.
Mobile saves the resized photos with the queued report and uploads them after the report
is created; Admin sees them as **Ảnh hiện trường** in the review detail.

## Web map consumer amendment — 2026-11-16

CONFIRMED establishes eligible evidence; it does not itself publish a map hazard. Once Admin applies ADD_HAZARD_AREA or UPDATE_HAZARD_AREA under CTMS-118, the matching authoritative hazard becomes visible through the shared viewport layer without a selected Route, Trip or drawn geometry. Current confirmation, evidence and applied hazard snapshot must match. Pending/rejected/reopened evidence is excluded. Public reads expose safety facts and verification, never review reasons, evidence or member data. See docs/business-rules/route-safety-v2.md, amended BR-475/477. No automatic review or corrective write is introduced.

## Review transitions and danger-zone proposals — 2026-11-16

Updated 2026-11-18: detection places candidates directly in UNDER_REVIEW. POST /api/admin/safety-hotspots/:id/review {status, reason} accepts CONFIRMED or DISMISSED from UNDER_REVIEW; legacy DETECTED records also remain actionable. Finalized decisions cannot be changed or replayed (409 INVALID_TRANSITION). GET /api/admin/safety-hotspots/:id/reviews lists the stored decisions. The Admin page offers "Xác nhận điểm nóng" and "Bác bỏ" immediately; each requires a reason and decision confirmation. Host and field-incident danger-zone proposals remain a separate queue ("Đề xuất điểm nguy hiểm"); they do not create or confirm hotspots. See docs/business-rules/route-safety-v2.md, "Danger-zone proposals and Admin review".

# CTMS-34 - Approve and Publish Trip

**Spec Reference**  
/file/spec/ctms-34-approve-and-publish-trip.md

**Status**  
To Do

**Story Title**
Approve and Publish Trip

**Story**  
As a Admin, I want to approve a pending Trip for publication or return it to draft so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Admin can approve a complete Trip from `pending_approval` to `published`.
- [ ] Admin can return a Trip from `pending_approval` to `draft` with reason.
- [ ] Publishing is blocked if the linked Route is `closed`, archived, or fails required safety validation.
- [ ] Published Trips become discoverable/bookable by Campers; draft and pending Trips do not.

## Scope

- Trip approval review and state transition.
- Publication timestamp and audit trail.

## Out of Scope

- No `rejected` Trip status.
- No direct `draft -> published` transition.
- No automatic publication after Route reopen.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-207, BR-208, BR-209, BR-210, BR-211, BR-212, BR-080, BR-081, BR-082`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `trips.status` transitions through draft, pending_approval, published, ongoing, completed, cancelled.
- `published_at` is set when status becomes `published`.

## State and Validation Rules

- Allowed transitions here: `pending_approval -> published`; `pending_approval -> draft`.
- Return reason is required for `pending_approval -> draft`.
- Every transition is audited with actor and before/after state.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-34`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Committed`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

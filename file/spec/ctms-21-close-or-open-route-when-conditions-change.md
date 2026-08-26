# CTMS-21 - Close or Open Route when Conditions Change

**Spec Reference**  
/file/spec/ctms-21-close-or-open-route-when-conditions-change.md

**Status**  
To Do

**Story Title**
Close or Open Route when Conditions Change

**Story**  
As a Host/Admin/System, I want to close or reopen an internal Route when safety or operational conditions change so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Authorized Host/Admin/System can set a Route to `closed` with reason and effective metadata.
- [ ] `closed` Route is a hard constraint for creating, editing, approving, and publishing Trips.
- [ ] Existing published Trips on a newly closed Route are flagged for revalidation or operational action.
- [ ] Reopening a Route does not automatically publish or approve affected Trips.

## Scope

- Internal route state management.
- Safety/operational enforcement for Trip workflows.
- Audit trail for route status changes.

## Out of Scope

- No Camper route browsing.
- No soft warning that can be bypassed when Route is `closed`.
- No campsite sub-area closure logic.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-186, BR-187, BR-200, BR-201, BR-206, BR-196, BR-197, BR-211, BR-212, BR-046, BR-047, BR-232`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `routes.status` supports `draft`, `pending_approval`, `active`, `closed`, and `archived`.
- Trip workflows reference `trips.route_id` and must read the current Route state.

## State and Validation Rules

- `active -> closed` blocks new Trip publication and approval.
- `closed -> active` permits future Trip validation but does not mutate Trip status automatically.
- Every status change records actor, reason, before/after status, and timestamp.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-21`
- Epic: `EPIC 3. Trekking Route and Checkpoint Management`
- Sprint: `Sprint 2`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

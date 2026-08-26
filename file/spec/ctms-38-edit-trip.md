# CTMS-38 - Edit Trip and Revalidate

**Spec Reference**  
/file/spec/ctms-38-edit-trip.md

**Status**  
To Do

**Story Title**
Edit Trip and Revalidate

**Story**  
As a Host, I want to edit a Trip and revalidate it against route, schedule, capacity, and publication rules so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Owning Host can edit Trip fields while the Trip is in an editable state.
- [ ] Edits revalidate linked Route status, schedule, capacity, price/free flag, meeting data, media, and waypoints.
- [ ] Material edits to a published Trip must trigger the required reapproval or safe operational handling defined by policy.
- [ ] Capacity cannot be lowered below current `seats_taken`.
- [ ] Failed revalidation creates no partial update.

## Scope

- Trip edit workflow and revalidation.
- Audit trail and affected-user notification trigger where applicable.

## Out of Scope

- No zone stay edit.
- No bypass of closed Route hard constraint.
- No direct Camper mutation.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-192, BR-193, BR-195, BR-207, BR-208, BR-209, BR-210, BR-211, BR-212, BR-220, BR-221, BR-204, BR-205, BR-092, BR-093, BR-094`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- Editable Trip fields are persisted on `trips`, `trip_media`, and `trip_waypoints`.
- Capacity edits use `capacity_min`, `capacity_max`, and existing `seats_taken` only.

## State and Validation Rules

- Route must not be closed for publishable Trip outcomes.
- Published Trip material edits require revalidation before continuing to accept bookings if policy says so.
- All writes happen in a transaction and are audited.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-38`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

# CTMS-32 - Create Trip

**Spec Reference**  
/file/spec/ctms-32-create-trip.md

**Status**  
To Do

**Story Title**
Create Trip

**Story**  
As a Host, I want to create a Trip draft from an internal active Route so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Trip creation starts with `status = draft`.
- [ ] Trip must reference an authorized Route that is not `closed` or `archived`.
- [ ] Trip stores schedule, meeting point/time, capacity_min, capacity_max, price/free flag, cancellation policy, and descriptive content.
- [ ] Trip is not visible to Campers until approval publishes it.

## Scope

- Host Trip draft creation.
- Initial validation of route, time window, capacity, and pricing fields.

## Out of Scope

- No direct `pending_approval` creation.
- No campsite-stay or retired campsite sub-area stay creation.
- No booking creation in this story.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-192, BR-193, BR-195, BR-204, BR-205, BR-072, BR-073, BR-074`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `trips.route_id` links to an internal Route.
- `trips.capacity_min`, `capacity_max`, and `seats_taken` are the only capacity fields.
- `trips.status` is set server-side to `draft`.

## State and Validation Rules

- Route must be active and authorized for the Host.
- `capacity_min <= capacity_max`; `seats_taken` starts at 0.
- Start/end/booking deadline are validated for chronological consistency.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-32`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Committed`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

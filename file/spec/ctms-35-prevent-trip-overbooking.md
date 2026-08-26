# CTMS-35 - Prevent Trip Overbooking

**Spec Reference**
/file/spec/ctms-35-prevent-trip-overbooking.md

**Status**
To Do

**Story Title**
Prevent Trip Overbooking

**Story**
As a System, I want to prevent booking transactions from exceeding Trip capacity so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Booking creation or confirmation checks Trip capacity inside the same transaction that changes booking/seats.
- [ ] The system locks the Trip row or otherwise serializes updates by `trip_id` when changing `seats_taken`.
- [ ] Confirmed/reserved people cannot make `seats_taken` exceed `capacity_max`.
- [ ] Failed conflicts roll back the whole business operation and leave capacity unchanged.
- [ ] Capacity is Trip-only; no retired campsite sub-area people/tent capacity participates.

## Scope

- Trip capacity enforcement shared by booking workflows.
- Concurrency protection for `trips.seats_taken`.

## Out of Scope

- No retired campsite sub-area locks.
- No tent counts or campsite-level capacity ledger.
- No cache-backed lock as the capacity source of truth.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-192, BR-193, BR-195, BR-083, BR-084, BR-085, BR-086, BR-087`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `trips.capacity_max` is the hard upper bound.
- `trips.seats_taken` changes only through transactional booking/member workflows.
- `bookings.num_people` contributes to capacity according to booking status rules.

## State and Validation Rules

- Only published Trips can accept Camper bookings.
- Capacity checks run after validating booking status and before commit.
- Conflict errors are deterministic and do not create partial bookings.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-35`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Committed`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

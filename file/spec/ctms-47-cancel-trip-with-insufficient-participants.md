# CTMS-47 - Cancel Trip

**Spec Reference**  
/file/spec/ctms-47-cancel-trip-with-insufficient-participants.md

**Status**  
To Do

**Story Title**
Cancel Trip

**Story**  
As a Host/Admin/System, I want to cancel a Trip when policy conditions such as insufficient participants are met so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Authorized actor can cancel a Trip when cancellation policy conditions are satisfied.
- [ ] Insufficient participants is evaluated against Trip `capacity_min` and current confirmed/active participants.
- [ ] Trip cancellation sets `trips.status = cancelled` and records actor/reason/time.
- [ ] Related bookings and payments enter the appropriate cancellation/refund workflows.
- [ ] Cancellation does not reference camp stays, zone stays, or campsite reservations.

## Scope

- Trip-level cancellation.
- Booking/refund handoff and notifications.
- Audit and idempotent cancellation behavior.

## Out of Scope

- No camp/zone stay release.
- No campsite slot unlock.
- No `rejected` status.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-192, BR-193, BR-195, BR-194, BR-204, BR-205, BR-123, BR-124, BR-125`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `trips.status` becomes `cancelled`.
- Bookings remain booking records and are processed according to booking/payment cancellation specs.

## State and Validation Rules

- Cancellation is idempotent for already-cancelled Trips.
- Invalid actor, invalid state, or unmet policy condition returns an error with no side effect.
- Affected Campers/Porters/Host are notified according to notification policy.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-47`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

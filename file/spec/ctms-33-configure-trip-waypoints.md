# CTMS-33 - Configure Trip Waypoints

**Spec Reference**
/file/spec/ctms-33-configure-trip-waypoints.md

**Status**
To Do

**Story Title**
Configure Trip Waypoints

**Story**
As a Host, I want to configure Trip waypoints and overnight points for a Trip draft so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Host can add, update, reorder, and remove `trip_waypoints` for a Trip draft.
- [ ] Each Trip has a coherent start-to-finish sequence with unique `sequence_order` values per Trip.
- [ ] Waypoints may reference Route checkpoints or define Trip-specific points with name/location.
- [ ] Overnight planning uses waypoint type `overnight`; it does not create trip camp stay rows.
- [ ] Waypoint days and planned times must fit inside Trip duration and schedule.

## Scope

- Trip-specific itinerary/waypoint plan.
- Snapshot or reference to route checkpoints as needed by implementation.

## Out of Scope

- No retired campsite-stay records.
- No retired campsite sub-area, tent-count, or campsite-capacity checks.
- No dependency on retired CTMS-31.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-192, BR-193, BR-195, BR-075, BR-076, BR-077, BR-078, BR-079, BR-236`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `trip_waypoints` store trip_id, checkpoint_id, type, name, location, day_number, sequence_order, planned_at, duration_minutes, note, and metadata.
- Valid waypoint types are from `trip_waypoint_type`: start, checkpoint, rest, meal, activity, overnight, finish.

## State and Validation Rules

- Trip must be editable by the owning Host and generally in `draft` unless CTMS-38 revalidation rules allow otherwise.
- A day_trip can have waypoints but should not require overnight waypoint entries.
- Invalid duplicate order/day/time combinations are rejected without partial writes.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-33`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

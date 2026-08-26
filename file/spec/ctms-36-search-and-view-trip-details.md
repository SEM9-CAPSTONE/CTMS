# CTMS-36 - Camper Search and View Trip

**Spec Reference**  
/file/spec/ctms-36-search-and-view-trip-details.md

**Status**  
To Do

**Story Title**
Camper Search and View Trip

**Story**  
As a Camper, I want to search and view published Trips so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Camper search returns only `published` Trips.
- [ ] Trip list/detail show title, schedule, difficulty, price/free flag, capacity availability, campsite/host summary, itinerary, includes/excludes, meeting information, media, and safety summary.
- [ ] Trip detail may include waypoint itinerary and safety context, but does not expose a standalone public Route browse/detail workflow.
- [ ] Closed Route or cancelled/unpublished Trip is not bookable.

## Scope

- Camper-facing Trip discovery and details.
- Published Trip read model for booking entry point.

## Out of Scope

- No campsite direct booking.
- No public Route booking.
- No camp/zone stay presentation.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-218, BR-219, BR-204, BR-205, BR-088, BR-089, BR-090, BR-091, BR-232, BR-233`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- Read from `trips`, `trip_media`, `trip_waypoints`, and public campsite/host summaries as allowed.
- Capacity availability derives from `capacity_max - seats_taken`.

## State and Validation Rules

- Only `published` Trips appear to Camper.
- If linked Route becomes closed, booking action is disabled/blocked even if Trip is still visible for operational reasons.
- Read APIs are paginated and expose only published fields.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-36`
- Epic: `EPIC 5. Trip Management`
- Sprint: `Sprint 3`
- Commitment: `Committed`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

# CTMS-23 - Manage Route Checkpoints and Hazard Operational Data

**Spec Reference**  
/file/spec/ctms-23-mark-danger-zones-and-shelters.md

**Status**  
To Do

**Story Title**
Manage Route Checkpoints and Hazard Operational Data

**Story**  
As a Host/Admin/System, I want to maintain checkpoint and hazard operational data for internal Route safety so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Authorized actors can create and update Route hazard areas with polygon geometry, description, and severity.
- [ ] Authorized actors can maintain checkpoints, including type, radius, expected arrival offset, instructions, and nearby water/shelter flag.
- [ ] Operational data is available to Trip planning, offline safety packages, and internal monitoring.
- [ ] Camper-facing exposure happens through published Trip safety/itinerary context, not raw Route browsing.

## Scope

- Route operational safety data.
- Checkpoint/hazard validation and audit.
- Internal reuse across many Trips.

## Out of Scope

- No retired campsite sub-area concept despite old wording around danger areas.
- No public Route detail page.
- No free-form unsafe geometry without validation.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-224, BR-225, BR-052, BR-053, BR-054, BR-232`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `checkpoints` store route_id, name, location, radius_m, type, expected_arrival_offset, instructions, nearby_water_or_shelter.
- `route_hazard_areas` store route_id, geom polygon, description, severity.

## State and Validation Rules

- Route must exist and be owned/authorized for the actor.
- Geometry must be valid and within supported coordinate bounds.
- Changes are audited and can trigger Trip/offline package revalidation where implemented.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-23`
- Epic: `EPIC 3. Trekking Route and Checkpoint Management`
- Sprint: `Sprint 2`
- Commitment: `Committed`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

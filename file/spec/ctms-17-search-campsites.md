# CTMS-17 - Search Campsites

**Spec Reference**  
/file/spec/ctms-17-search-campsites.md

**Status**  
To Do

**Story Title**
Search Campsites

**Story**  
As a Camper, I want to search published campsites without seeing retired zone, capacity, or price filters so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Search supports published campsite fields such as province, name text, amenities, and location metadata.
- [ ] Only `campsites.status = active` records appear to Camper search.
- [ ] Results include campsite name, location/province, cover media, amenities summary, and public campsite status.
- [ ] Search does not expose zone, capacity, price, or route detail filters.

## Scope

- Camper-facing campsite discovery.
- Pagination and sorting over public campsite fields.
- Clear empty and error states without leaking private resource state.

## Out of Scope

- No retired campsite sub-area or campsite-capacity filters.
- No campsite price range if price is not stored on campsite in v2.
- No active routes payload in campsite search results.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-218, BR-219, BR-220, BR-221, BR-039, BR-040, BR-041, BR-232`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- Read from `campsites` and verified `campsite_media` only for public fields.
- Do not join retired v1 campsite sub-area or campsite-stay models.
- Filter and sort only by fields approved for public listing.

## State and Validation Rules

- Draft, pending_approval, temporarily_closed, suspended, and archived campsites are not shown to Campers.
- Invalid filters return validation errors without side effects.
- Search is read-only and must not create locks or reservations.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-17`
- Epic: `EPIC 2. Campsite Management`
- Sprint: `Sprint 2`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

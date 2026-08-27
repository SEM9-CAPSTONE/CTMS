# CTMS-18 - View Campsite Details

**Spec Reference**  
/file/spec/ctms-18-view-campsite-details.md

**Status**  
In Progress

**Story Title**
View Campsite Details

**Story**  
As a Camper, I want to view public campsite details without browsing internal Routes directly so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Camper can open details for an active campsite.
- [ ] Details show public campsite profile, media, amenities, policies, location/province, terrain note, and operating/season information where available.
- [ ] Details do not expose a public Route browse/detail surface.
- [ ] Details may guide Campers toward published Trips associated with the campsite where such Trip discovery exists.

## Scope

- Public campsite detail page/API.
- Private/internal fields are hidden unless actor has Host/Admin privileges through a separate management workflow.

## Out of Scope

- No public Route detail before joining.
- No retired campsite sub-area, campsite capacity, layout-reservation, or tent-count fields.
- No booking action against campsite directly.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-196, BR-197, BR-214, BR-215, BR-218, BR-219, BR-220, BR-221, BR-042, BR-055, BR-232`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- Read from `campsites` and `campsite_media` for public detail.
- Trip summaries, if included, must come from `trips.status = published` and not from raw route browsing.

## State and Validation Rules

- Only active campsites are visible to Camper detail.
- Missing or non-public campsite returns not found or a safe unavailable response.
- Routes remain internal even when linked to the campsite.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.
- **Backend (CTMS-76)**: `GET /api/campsites/:id` — public Camper endpoint returning `CampsiteDetailDto` (campsite profile + media, no zones/hostId/rejectionReason). Active-only filter at DB level. `upcomingTrips: []` frozen until Trip domain is built. Unit tests in `campsites.service.spec.ts`.

## References

- Story ID: `CTMS-18`
- Epic: `EPIC 2. Campsite Management`
- Sprint: `Sprint 2`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

# CTMS-30 - Configure Weather Risk Rules

**Spec Reference**  
/file/spec/ctms-30-configure-weather-risk-rules.md

**Status**  
To Do

**Story Title**
Configure Weather Risk Rules

**Story**  
As a Admin/System, I want to configure weather risk rules without depending on route_type so that CTMS follows the v2 domain baseline and avoids retired zone/slot/route-public behavior.

## Baseline v2 Principles

- Campsite -> Route -> Trip -> Booking is the active domain chain.
- Trekking Route is an internal reusable geospatial and safety resource. Campers do not browse or book Routes directly. Campers discover and book published Trips.
- Route checkpoints and hazard areas are operational route data for Host/Admin/System workflows and for Trip safety snapshots.
- Trip capacity is controlled only by `trips.capacity_min`, `trips.capacity_max`, and `trips.seats_taken`.
- Retired v1 planning concepts must not be reintroduced under this CTMS logical ID.

## Acceptance Criteria

- [ ] Admin/System can configure thresholds for rainfall, wind, temperature, humidity, visibility, UV, and storm alerts.
- [ ] Rules do not require or branch on `route_type`.
- [ ] Risk evaluation can be applied to Trip/Route locations and forecast windows using weather snapshots.
- [ ] Rule changes are versioned or audited so generated advice can be traced.

## Scope

- Weather rule configuration and validation.
- Rule use by weather risk scoring and safety advice workflows.

## Out of Scope

- No route_type dependency.
- No hard-coded thresholds in application logic.
- No direct Camper override of risk outcomes.

## Business Rules Mapping

- Story-level BRs: `BR-188, BR-190, BR-191, BR-216, BR-217, BR-228, BR-229, BR-230, BR-186, BR-187, BR-200, BR-201, BR-206, BR-196, BR-197, BR-207, BR-208, BR-209, BR-210, BR-069, BR-070, BR-071`
- BR source: `D:/Downloads/CTMS- Business rules.xlsx`, sheet `BR-story mapping`, baseline v2.
- Removed CTMS IDs 12, 13, 14, 24, and 31 are intentionally absent from active BR mapping.

## Data Contract

- `weather_snapshots` contain measured/forecast weather factors and location/time.
- `weather_rules` define active thresholds and risk outputs independently of route type.

## State and Validation Rules

- Only authorized Admin/System actors can change active rules.
- Invalid thresholds or overlapping contradictory rules are rejected.
- Rule updates do not mutate historical snapshots; they affect future evaluations according to effective dating/versioning.

## Implementation Notes

- This document is a requirements baseline only; do not infer implementation completion from the spec status.
- Backend validation and authorization are authoritative; UI validation is only a usability layer.
- Update tests, API contracts, migrations/entities, and documentation together when implementing this spec.

## References

- Story ID: `CTMS-30`
- Epic: `EPIC 4. Weather Risk Assessment`
- Sprint: `Sprint 2`
- Commitment: `Stretch`
- Baseline: `v2`
- Source documents: `D:/Downloads/TÍNH NĂNG HỆ THỐNG CTMS.docx`, `D:/Downloads/CTMS.sql`, `D:/Downloads/CTMS- Business rules.xlsx`

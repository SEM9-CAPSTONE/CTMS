# CTMS-47 - Merged into CTMS-46

**Spec Reference**  
/file/spec/ctms-47-hire-porter-to-trekking-trip.md

**Story Title**  
Merged into CTMS-46 - Respond to Porter Request

**Status**  
Removed

**Merge Decision**  
CTMS-47 is no longer a separate feature.

1. Host creates a Porter Request for a Trip in CTMS-45.
2. Porter accepts or declines the request in CTMS-46.
3. When the Porter accepts, CTMS creates the Porter Assignment in the same transaction.

No separate Host hire/assign confirmation is required after Porter acceptance.

## Replacement Scope

Implement the assignment behavior in CTMS-46:

- Accepting a valid Porter Request atomically changes the request to ACCEPTED and creates the Porter Assignment.
- Declining a Porter Request must not create a Porter Assignment.
- If assignment validation fails, the request must remain unchanged and no assignment is created.
- Assignment validation, lead porter eligibility, route qualification, and schedule conflict rules are owned by CTMS-46.

## Migrated Business Rules

The following rules previously listed under CTMS-47 are now enforced by CTMS-46:

- BR-158
- BR-159
- BR-160
- BR-161
- BR-225

## Dependency Update

Stories that previously depended on CTMS-47 should now depend on CTMS-46:

- CTMS-48 - View Assigned Trips
- CTMS-52 - Create Offline Package for Each Trip
- CTMS-56 - Update Trip Operational Lifecycle and Progress
- CTMS-93 - View Overview of Bookings, Routes, Porters, and Alerts
- CTMS-99 - Review Porter after Trip

## References

- Story ID: `CTMS-47`
- Replacement story: `CTMS-46`
- Epic: `EPIC 8. Porter Management`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `version 3`
- Business Rules source: `CTMS- Business rules.xlsx`

# CTMS-025 — Search and View Trip Details

## 1. Overview

Story: CTMS-025

Epic: EPIC 4. Trip Management

Use Case: Search and View Trip Details

Priority: Must Have

Goal: Allow Camper to search publicly eligible Trips and view the information needed to evaluate a Trip without exposing internal Route or unrelated private data.

Backlog story: As a Camper, I want to search and view Trip details so I can find a suitable trekking Trip.

Acceptance Criteria:

| Source  | Criterion                                                                             |
| ------- | ------------------------------------------------------------------------------------- |
| PB AC-1 | Camper can search Trips that are eligible for public discovery.                       |
| PB AC-2 | Search supports the approved Trip filters.                                            |
| PB AC-3 | Trip Detail exposes the approved public Trip information and itinerary.               |
| PB AC-4 | Trip waypoints are displayed using the authoritative chronological itinerary.         |
| PB AC-5 | Internal/non-public Route, Checkpoint, hazard, or unrelated user data is not exposed. |

## 2. Scope

### In Scope

- Public Trip search.
- Approved search filters.
- Trip Detail.
- Public itinerary.
- Public location/schedule/capacity/price information as approved.
- Public-safe projection of Route-related information.

### Out of Scope

- Direct public Route browsing.
- Booking creation.
- Risk calculation.
- Internal/admin Route data.

## 3. Actors & Authorization

- Camper.
- Public/authorized viewer where the product permits.
- System.

Public visibility is determined by backend Trip state and visibility policy.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-023.
- CTMS-016.

Trip must be eligible for public discovery/detail according to authoritative state.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-073 | Camper discovery is Trip-centered. Only Trips with status = published that are not completed or cancelled may be searched or viewed as public Trips. If the Trip's Route version is closed or otherwise becomes ineligible before departure, the Trip may remain readable for already-related users, but it must no longer be presented as bookable and must not accept new Bookings. |
| BR-074 | Trip search may expose only approved filters such as time range, trip_type, difficulty, price, province, and city. Area filtering must use the Trip's province_code/city_code snapshot. The Camper experience must not expose direct Route browsing or Route-level filters.                                                                                                           |
| BR-075 | Camper-facing Trip Detail must show starts_at/ends_at, meeting_point, province/city, price, remaining capacity, itinerary/waypoints/overnight locations, inclusions/exclusions, media, and Weather Risk. It must not expose route_id, raw route_geom, or checkpoint/hazard administration data.                                                                                       |
| BR-214 | Routes, checkpoints, hazard areas, and raw geometry are internal operational data for Host/Admin/System use. Camper APIs must not provide Route List/Route Detail or expose raw route_geom, checkpoint, or hazard-management data.                                                                                                                                                    |

## 6. State & Lifecycle

Read-only workflow.

Eligible published Trip
→ searchable
→ detail viewable.

Trip leaves public-eligible state
→ no longer returned as publicly available according to visibility policy.

## 7. Business Flow

1. Camper opens Trip discovery.
2. Camper supplies optional approved filters.
3. Backend validates filters.
4. Backend searches only public-eligible Trips.
5. Results are returned.
6. Camper selects a Trip.
7. Backend reloads authoritative Trip.
8. Backend verifies public visibility.
9. Backend returns approved Trip projection and itinerary.
10. Internal Route/safety/private information is excluded.

## 8. Data & Invariants

- Search never turns an unpublished Trip into a public resource.
- Search/detail uses authoritative Trip state.
- Province/city filtering uses the approved Trip geographic snapshot where defined.
- Waypoints are ordered by authoritative `planned_at`.
- Internal Route geometry is not automatically public.
- Private Booking/member information is not included in public Trip Detail.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                      | Expected Behavior                                |
| ----------------------------------------- | ------------------------------------------------ |
| No Trips match                            | Return valid empty result.                       |
| Invalid filter                            | Validation error.                                |
| Trip not public                           | Do not expose as public Trip.                    |
| Trip cancelled after search result loaded | Detail reload reflects authoritative state.      |
| Request attempts internal Route data      | Apply actor visibility; do not leak.             |
| Legacy waypoint ordering differs          | `planned_at`-based authoritative itinerary wins. |

## 11. Acceptance & Test Matrix

| Source          | Scenario                               | Expected Result                       | Test Type            |
| --------------- | -------------------------------------- | ------------------------------------- | -------------------- |
| PB AC-1, BR-073 | Search public Trips                    | Only eligible Trips returned          | Integration          |
| PB AC-2, BR-074 | Apply supported filters                | Matching Trips returned               | Search / Integration |
| PB AC-3, BR-075 | Open eligible Trip                     | Approved detail returned              | E2E                  |
| PB AC-4, BR-075 | View itinerary                         | Waypoints chronologically represented | Integration          |
| PB AC-5, BR-214 | Public user requests internal geometry | Unauthorized data omitted/rejected    | Security             |
| BR-073          | Cancelled/unpublished Trip             | Not presented as public eligible Trip | State                |

## 12. Open Decisions

Exact pagination/sorting defaults and the complete public Trip DTO belong to Technical Design unless explicitly defined in PB/Data Dictionary.

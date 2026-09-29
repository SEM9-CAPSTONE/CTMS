# CTMS-039 — Manage Simple Equipment Catalog

## 1. Overview

Story: CTMS-039

Epic: EPIC 6. Equipment and Logistics

Use Case: Manage Simple Equipment Catalog

Priority: Must Have

Goal: Allow Host to manage a quantity-based MVP equipment catalog without introducing unnecessary per-physical-asset maintenance complexity.

Backlog story: As a Host, I want to manage my equipment catalog so equipment can be offered for Trip Booking and rental.

Acceptance Criteria:

| Source  | Criterion                                                                        |
| ------- | -------------------------------------------------------------------------------- |
| PB AC-1 | Authorized Host can create/update equipment within their business scope.         |
| PB AC-2 | Catalog stores the minimum required equipment fields.                            |
| PB AC-3 | Quantity and rental price are validated as non-negative authoritative values.    |
| PB AC-4 | Equipment uses the approved simple catalog status lifecycle.                     |
| PB AC-5 | MVP does not require per-asset physical-item maintenance/depreciation lifecycle. |

## 2. Scope

### In Scope

- Create equipment catalog entry.
- Edit equipment catalog entry.
- Name/category.
- Total quantity.
- Rental price per day.
- Catalog status.
- Host ownership/business scope.

### Out of Scope

- Per-physical-item asset tracking.
- Maintenance scheduling.
- Depreciation.
- Repair lifecycle unless separately approved.
- Equipment reservation; CTMS-040.
- Handover/return; CTMS-041.

## 3. Actors & Authorization

- Host: own catalog.
- Admin: only according to explicit administrative permission.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-006.

Actor must be authorized for the equipment business scope.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-124     | A Host may create or edit a simple equipment catalog only within that Host's own business scope. Admin intervention is allowed only under administrative permissions. quantity_total, rental_price_per_day, and status must be validated by the backend.                                                      |
| BR-125     | The MVP uses only equipment catalog statuses active/inactive/retired together with the reservation/handover/return states required for rental operations. Per-asset physical-state modeling is not required.                                                                                                  |
| BR-126     | The MVP equipment catalog must store, at minimum, a valid host_id, name/category, quantity_total >= 0, rental_price_per_day >= 0, and status. maintenance_schedule, repair lifecycle, depreciation, and per-asset maintenance are not required MVP data.                                                      |
| BR-131     | The MVP manages equipment inventory by quantity at the catalog/reservation level and does not require equipment_items or equipment_reservation_items for individual assets. If per-item tracking is added later, it must be implemented as a separate extension rather than as a prerequisite for MVP rental. |
| BR-174     | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                 |
| BR-175     | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                                                              |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                         |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                  |

## 6. State & Lifecycle

Catalog status:

`active`
↔ `inactive`

and:

→ `retired`

Exact permitted reverse transitions follow authoritative enum/state policy.

Retirement must not erase historical reservation records.

## 7. Business Flow

1. Host opens catalog.
2. Backend authorizes Host.
3. Host creates/edits equipment.
4. Validate ownership.
5. Validate name/category.
6. Validate `quantity_total >= 0`.
7. Validate `rental_price_per_day >= 0`.
8. Validate status.
9. Validate impact on existing commitments where applicable.
10. Persist.
11. Return authoritative catalog state.

## 8. Data & Invariants

Minimum:

- valid `host_id`;
- name;
- category;
- `quantity_total >= 0`;
- `rental_price_per_day >= 0`;
- approved status.

MVP does not require individual asset rows merely to represent each physical unit.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                          | Expected Behavior                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Host edits another Host's equipment           | Reject.                                                                   |
| Negative quantity                             | Reject.                                                                   |
| Negative rental price                         | Reject.                                                                   |
| Invalid status                                | Reject.                                                                   |
| Retire equipment with historical reservations | Preserve historical records; apply approved future-availability behavior. |
| Client sends derived availability             | Backend inventory remains authoritative.                                  |

## 11. Acceptance & Test Matrix

| Source          | Scenario                      | Expected Result                          | Test Type    |
| --------------- | ----------------------------- | ---------------------------------------- | ------------ |
| PB AC-1, BR-124 | Host creates own catalog item | Accepted                                 | E2E          |
| PB AC-1         | Cross-Host edit               | Rejected                                 | Security     |
| PB AC-2, BR-126 | Required fields valid         | Persisted                                | Integration  |
| PB AC-3         | Negative quantity/price       | Rejected                                 | Boundary     |
| PB AC-4, BR-125 | Approved status               | Accepted                                 | State        |
| PB AC-5, BR-126 | MVP catalog created           | No mandatory per-asset maintenance model | Architecture |

## 12. Open Decisions

None. Per-asset maintenance/depreciation is explicitly outside the MVP requirement unless a later approved story introduces it.

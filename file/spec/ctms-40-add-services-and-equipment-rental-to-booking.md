# CTMS-040 — Add Services and Equipment Rental to Booking

## 1. Overview

Story: CTMS-040

Epic: EPIC 6. Equipment and Logistics

Use Case: Add Services and Equipment Rental to Booking

Priority: Must Have

Goal: Allow valid add-ons and equipment rentals to be added to an eligible Booking while keeping surcharge calculation and equipment inventory authoritative on the backend.

Backlog story: As a Camper, I want to add services and rent equipment for my Booking so required extras are reserved and included in the Booking total.

Acceptance Criteria:

| Source  | Criterion                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Valid non-equipment add-ons are stored as Booking items.                                                    |
| PB AC-2 | Equipment rental is stored as an equipment reservation, not as an inventory-holding Booking item.           |
| PB AC-3 | Booking surcharge and total are recalculated from server-side data.                                         |
| PB AC-4 | Equipment availability considers authoritative quantity, overlapping reservation period and catalog status. |
| PB AC-5 | Rental price is snapshotted from authoritative catalog price.                                               |
| PB AC-6 | Concurrent equipment reservations cannot exceed available inventory.                                        |
| PB AC-7 | Failed reservation does not leave partial Booking/item/inventory state.                                     |

## 2. Scope

### In Scope

- Add non-equipment Booking add-on.
- Validate whitelisted add-on.
- Recalculate surcharge/total.
- Create equipment reservation.
- Validate rental period.
- Validate equipment availability.
- Snapshot rental price.
- Protect inventory under concurrency.

### Out of Scope

- Equipment catalog management; CTMS-039.
- Handover/return; CTMS-041.
- Arbitrary client-defined add-on types.
- Using `booking_items` as equipment inventory reservation.

## 3. Actors & Authorization

- Camper/authorized Booking owner.
- System.

Backend validates Booking ownership and referenced add-on/equipment business scope.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-029.
- CTMS-039.

Booking must exist and permit add-on/rental modification.

Equipment must exist in applicable catalog state.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-121     | booking_items may store only non-equipment add-ons or surcharges. item_type/ref_id must be validated by the backend against an approved whitelist, and quantity must be greater than 0.                                                        |
| BR-122     | Any change to booking_items must cause surcharge and total_amount to be recalculated from server-side data. A client-supplied final total must never be treated as authoritative.                                                              |
| BR-123     | Rental equipment must be stored in equipment_reservations. booking_items must not be used to reserve equipment inventory.                                                                                                                      |
| BR-127     | Availability for a rental period equals quantity_total minus the total quantity of reservations that overlap the rental_range and are either held or handed over. Catalog entries with status inactive or retired must not accept new rentals. |
| BR-128     | Rental fees must be calculated server-side from rental days, quantity, and rental_price_per_day. unit_price and total_price must be snapshotted into the reservation so historical pricing does not change when the catalog price changes.     |
| BR-129     | Creating or updating an equipment reservation must use transaction locking or an equivalent concurrency-control mechanism so that overlapping reserved quantity never exceeds quantity_total. Conflicts must roll back.                        |
| BR-174     | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                  |
| BR-175     | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                               |
| BR-183     | Every data relationship must reference an existing, valid record. Child records must not be created for a resource outside the correct business scope.                                                                                         |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                          |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                   |

## 6. State & Lifecycle

### Non-equipment add-on

No Booking item
→ add valid item
→ active Booking item.

### Equipment

Available catalog quantity
→ create `equipment_reservation`
→ quantity reserved for applicable period.

Subsequent handover/return lifecycle belongs to CTMS-041.

## 7. Business Flow

1. Camper opens eligible Booking.
2. Backend verifies ownership/state.
3. Camper chooses add-on or equipment.

For non-equipment add-on:

4. Validate whitelisted `item_type/ref_id`.
5. Validate quantity > 0.
6. Calculate authoritative surcharge.
7. Persist Booking item.
8. Recalculate Booking total.

For equipment:

4. Load catalog item.
5. Validate catalog status.
6. Determine applicable rental interval.
7. Calculate overlapping reservations.
8. Calculate authoritative available quantity.
9. Snapshot rental price.
10. Lock/protect inventory.
11. Create equipment reservation.
12. Recalculate applicable Booking amount.
13. Commit atomically.

## 8. Data & Invariants

- Equipment inventory is not held by `booking_items`.
- Equipment uses `equipment_reservations`.
- `booking_items.quantity > 0`.
- Client total is not authoritative.
- Rental price is snapshotted from server source.
- Overlapping reservations cannot exceed `quantity_total`.
- Inactive/retired equipment cannot be newly reserved where policy prohibits it.
- Failed transaction leaves no partial reservation/price mutation.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                            | Expected Behavior                                 |
| ----------------------------------------------- | ------------------------------------------------- |
| Unknown add-on type                             | Reject.                                           |
| Add-on quantity <= 0                            | Reject.                                           |
| Client modifies total                           | Server recalculates.                              |
| Equipment inactive/retired                      | Reject new reservation according to policy.       |
| Requested equipment unavailable                 | Reject.                                           |
| Two Campers request final unit                  | At most available quantity commits.               |
| Catalog price changes after reservation         | Existing approved snapshot remains authoritative. |
| Transaction fails                               | Roll back reservation/Booking financial changes.  |
| Equipment incorrectly submitted as booking_item | Reject/use equipment-reservation workflow.        |

## 11. Acceptance & Test Matrix

| Source          | Scenario                           | Expected Result                     | Test Type                  |
| --------------- | ---------------------------------- | ----------------------------------- | -------------------------- |
| PB AC-1, BR-121 | Valid add-on                       | Booking item created                | Integration                |
| PB AC-1         | Unknown add-on                     | Rejected                            | Validation                 |
| PB AC-2, BR-123 | Equipment selected                 | Equipment reservation used          | Architecture / Integration |
| PB AC-3, BR-122 | Add-on changes                     | Total recalculated server-side      | Financial Integration      |
| PB AC-4, BR-127 | Overlapping inventory exists       | Availability correctly calculated   | Integration                |
| PB AC-5, BR-128 | Rental reserved                    | Authoritative price snapshot stored | Integration                |
| PB AC-6, BR-129 | Concurrent final-unit reservations | Inventory not exceeded              | Concurrency                |
| PB AC-7, BR-129 | Reservation transaction fails      | No partial state                    | Transaction                |

## 12. Open Decisions

Exact rental interval derivation and allowed Booking states for adding/removing extras must follow the authoritative Booking/equipment contract if not already defined by the mapped BR set.

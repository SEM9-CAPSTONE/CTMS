# CTMS-041 — Manage Equipment Handover and Return

## 1. Overview

Story: CTMS-041

Epic: EPIC 6. Equipment and Logistics

Use Case: Manage Equipment Handover and Return

Priority: Should Have

Goal: Track equipment handover, return, damage, loss and outstanding quantities without incorrectly restoring unavailable inventory.

Acceptance Criteria:

| Source  | Criterion                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Valid handover transitions an eligible reservation from reserved to picked_up and records handover metadata. |
| PB AC-2 | Handover actor and receiver must belong to the applicable Trip/Booking scope.                                |
| PB AC-3 | Return records good, damaged, lost and outstanding quantities whose total equals picked-up quantity.         |
| PB AC-4 | Reservation becomes returned only when outstanding quantity is zero and all picked-up quantity is resolved.  |
| PB AC-5 | Damaged/lost/outstanding quantity is not automatically returned to available inventory.                      |
| PB AC-6 | Overdue unresolved reservation may become not_returned through an idempotent flow.                           |

## 2. Scope

### In Scope

- Equipment handover.
- Equipment return.
- Picked-up quantity.
- Good returned quantity.
- Damaged quantity.
- Lost quantity.
- Outstanding quantity.
- Condition summary.
- Overdue/not-returned handling.

### Out of Scope

- Per-asset maintenance/repair lifecycle.
- Equipment catalog creation.
- Rental reservation creation.
- Automatic inventory adjustment for damaged/lost equipment.

## 3. Actors & Authorization

- Host/authorized Porter: handover actor where permitted.
- Booking participant/authorized receiver.
- System: overdue processing.

Backend validates Trip/Booking relationship and actor permission.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-040.
- CTMS-037.

Equipment reservation exists and is in an eligible state.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-130     | A valid handover transitions a reservation from reserved to picked_up and stores picked_up_at, the recipient, and handed_over_by. Repeated handover requests must be idempotent.                                                                                                                                                                                                                                                                         |
| BR-132     | When the recipient has a user account, that recipient must belong to the related Booking/Trip. handed_over_by must be an authorized Host or Porter on the Trip. The handover timestamp must be server-generated and must not trust the client.                                                                                                                                                                                                           |
| BR-133     | When equipment is returned, the system must record good_returned_quantity, damaged_quantity, lost_quantity, outstanding_quantity, returned_at, and a condition summary based on the actual outcome. All outcome quantities must be non-negative, mutually non-overlapping, and must sum exactly to picked_up_quantity. The reservation may transition to returned only when outstanding_quantity = 0 and all quantities have been validly accounted for. |
| BR-134     | In the MVP, damaged equipment is represented by damaged_quantity and a condition note on the rental. Damaged quantity must not automatically return to available inventory until an authorized Host performs an appropriate inventory adjustment. The system must not automatically create repair orders, maintenance workflows, or complex per-asset lifecycle records.                                                                                 |
| BR-135     | Lost equipment must be recorded in lost_quantity and must not return to available inventory. Any reduction to quantity_total, or restoration when lost equipment is recovered, must occur through an explicit authorized Host/Admin inventory adjustment and must be audited. Inventory must not be silently changed from client input.                                                                                                                  |
| BR-136     | An overdue or unreturned rental with outstanding_quantity > 0 may transition to not_returned through an idempotent scheduled or manual flow. Outstanding quantity must remain excluded from availability until returned or handled by a valid adjustment. The system must not automatically create maintenance or repair lifecycle records.                                                                                                              |
| BR-176     | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                                                                                                                                                                                                                                |
| BR-177     | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                                                                                                                                                                                                                                |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                                                    |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                                             |

## 6. State & Lifecycle

`reserved`
→ handover
→ `picked_up`

Then:

`picked_up`
→ all quantity resolved + outstanding = 0
→ `returned`

or:

`picked_up`
→ overdue + outstanding > 0
→ `not_returned`

Exact later recovery from `not_returned` follows authoritative equipment policy.

## 7. Business Flow

1. Authorized actor opens reservation.
2. Backend validates Trip/Booking scope.
3. Validate reservation state.
4. For handover:
   - record picked-up quantity;
   - receiver;
   - `handed_over_by`;
   - server pickup time;
   - transition to picked_up.
5. For return:
   - record good returned;
   - damaged;
   - lost;
   - outstanding;
   - condition summary.
6. Validate outcome quantities sum to picked-up quantity.
7. Restore only quantity eligible to become available.
8. Keep damaged/lost/outstanding excluded.
9. Transition to returned only when all quantity resolved.
10. Commit atomically.
11. Overdue unresolved reservation may later enter not_returned.

## 8. Data & Invariants

`good_returned + damaged + lost + outstanding = picked_up_quantity`

All outcome quantities >= 0.

Additional invariants:

- Client does not set authoritative timestamps.
- Damaged quantity is not automatically available.
- Lost quantity is not automatically available.
- Outstanding quantity remains unavailable.
- Return cannot silently alter `quantity_total`.
- Inventory adjustment requires explicit authorized operation.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                   | Expected Behavior                            |
| -------------------------------------- | -------------------------------------------- |
| Unauthorized handover actor            | Reject.                                      |
| Reservation not reserved               | Reject/no-op according to idempotency state. |
| Handover repeated                      | No duplicate pickup.                         |
| Return quantities negative             | Reject.                                      |
| Return quantities do not sum correctly | Reject.                                      |
| Outstanding > 0                        | Do not mark returned.                        |
| Damaged/lost equipment                 | Do not restore automatically.                |
| Overdue job repeated                   | No duplicate not_returned transition.        |

## 11. Acceptance & Test Matrix

| Source              | Scenario                   | Expected Result            | Test Type   |
| ------------------- | -------------------------- | -------------------------- | ----------- |
| PB AC-1, BR-130     | Valid handover             | picked_up recorded         | E2E         |
| PB AC-2, BR-132     | Unauthorized actor         | Rejected                   | Security    |
| PB AC-3, BR-133     | Valid return quantities    | Accepted                   | Integration |
| PB AC-3             | Quantity sum mismatch      | Rejected                   | Boundary    |
| PB AC-4             | Outstanding = 0            | May become returned        | State       |
| PB AC-5, BR-134/135 | Damaged/lost equipment     | Not restored automatically | Inventory   |
| PB AC-6, BR-136     | Overdue outstanding rental | not_returned allowed       | Worker      |

## 12. Open Decisions

Exact inventory-adjustment workflow is outside this story and must follow the approved catalog/inventory contract.

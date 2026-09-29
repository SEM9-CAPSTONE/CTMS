# CTMS-030 — Add Members to Booking

## 1. Overview

Story: CTMS-030

Epic: EPIC 5. Booking and Payment

Use Case: Add Members to Booking

Priority: Must Have

Goal: Allow the Booking owner to provide participant information while ensuring member count, Booking ownership and Trip capacity remain consistent.

Backlog story: As a Camper, I want to add members to my Booking so the system knows who will participate in the Trip.

Acceptance Criteria:

| Source  | Criterion                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| PB AC-1 | Booking owner can add required member information while Booking state permits modification.                  |
| PB AC-2 | Member records must belong to the correct Booking.                                                           |
| PB AC-3 | Member count must remain consistent with the authoritative Booking participant count/capacity reservation.   |
| PB AC-4 | Required member fields and duplicate constraints are validated according to the authoritative data contract. |
| PB AC-5 | Invalid member updates do not partially corrupt Booking membership.                                          |

## 2. Scope

### In Scope

- Add Booking members.
- Validate member data.
- Associate member with Booking.
- Maintain member-count consistency.
- Prevent unauthorized cross-Booking modification.

### Out of Scope

- Check-in; CTMS-037.
- Booking payment.
- Trip capacity definition.
- User account creation unless separately specified.

## 3. Actors & Authorization

- Camper / Booking owner.
- System.

Backend verifies ownership/authorized relationship.

## 4. Preconditions & Dependencies

- CTMS-029 Booking exists.
- Booking state permits member modification.
- Actor owns/is authorized for Booking.
- Capacity reservation remains valid.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-085 | booking_members stores all participants and preserves their status history, including the person who made the Booking. Before Trip start, a member with status = removed must not count as an active seat holder. The number of effective members in a Booking must never exceed num_people.                                                                                                                                     |
| BR-086 | Each Booking must have exactly one booking_member with is_primary = true.                                                                                                                                                                                                                                                                                                                                                        |
| BR-087 | Before the Trip starts, bookings.num_people must equal the number of effective booking_members whose status is not removed. Adding or removing a member must update num_people and the seat reservation in the same transaction. After Trip start, changing a member to joined, no_show, or left is part of the operational lifecycle and must not retroactively change the historical seat usage of the Booking.                 |
| BR-088 | A non-null user_id must not appear more than once within the same Booking. Adding a member must not cause the Booking to exceed trips.capacity_max.                                                                                                                                                                                                                                                                              |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                                                                                                                                             |
| BR-173 | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                                                                                                                                                                                                |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                                                                                                                                                                                                                                                    |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively.                                                                                                                                                                                                                                  |
| BR-176 | Any business operation that changes multiple tables or records must execute within a transaction. If any step fails, the entire operation must roll back.                                                                                                                                                                                                                                                                        |
| BR-177 | A failed operation must not leave data, state, reserved capacity, money, or inventory in a partially processed condition.                                                                                                                                                                                                                                                                                                        |
| BR-180 | Every stateful resource must follow its defined state transitions and must not use values outside the database enum.                                                                                                                                                                                                                                                                                                             |
| BR-181 | Before changing state, the system must validate the current state. A request based on stale state must be rejected with a business-conflict error.                                                                                                                                                                                                                                                                               |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                                                                            |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                                                                     |

## 6. State & Lifecycle

Booking
→ member data incomplete
→ add/update valid members
→ required membership data complete.

Member participation/check-in lifecycle starts later under CTMS-037.

## 7. Business Flow

1. Camper opens owned Booking.
2. Backend authorizes access.
3. Backend verifies Booking state.
4. Camper submits member data.
5. Validate required fields.
6. Validate duplicate/member relationship rules.
7. Validate participant count against Booking/capacity.
8. Persist member changes atomically.
9. Return authoritative member list.

## 8. Data & Invariants

- Member belongs to one intended Booking relationship.
- Member mutation cannot target another Camper's Booking.
- Member count cannot silently exceed reserved Booking capacity.
- Invalid batch update does not leave partial membership.
- Check-in state is not established through this story.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                     |
| --------------------------------------- | ------------------------------------- |
| Unauthorized Booking                    | Reject.                               |
| Booking no longer editable              | Conflict.                             |
| Missing required member data            | Reject.                               |
| Duplicate prohibited member             | Reject.                               |
| Member count exceeds Booking allocation | Reject.                               |
| Multi-member update partially invalid   | Roll back authoritative batch change. |

## 11. Acceptance & Test Matrix

| Source  | Scenario                               | Expected Result                    | Test Type   |
| ------- | -------------------------------------- | ---------------------------------- | ----------- |
| PB AC-1 | Owner adds valid member                | Member persisted                   | E2E         |
| PB AC-2 | Add to unrelated Booking               | Rejected                           | Security    |
| PB AC-3 | Member count within allocation         | Accepted                           | Integration |
| PB AC-3 | Member count exceeds allocation        | Rejected                           | Boundary    |
| PB AC-4 | Required data missing                  | Rejected                           | Validation  |
| PB AC-5 | One member invalid in atomic operation | No inconsistent partial membership | Transaction |

## 12. Open Decisions

The exact required member fields and duplicate identity rule must come from the authoritative Data Dictionary/Business Rules. They are not safely inferable from the current generated spec text.

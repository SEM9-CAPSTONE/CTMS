# CTMS-029 — Create Booking for Trip

## 1. Overview

Story: CTMS-029

Epic: EPIC 5. Booking and Payment

Use Case: Create Booking for Trip

Priority: Must Have

Goal: Allow an eligible Camper to create a Booking for a Trip while enforcing Trip availability, registration policy, capacity and authoritative pricing before any seat is committed.

Backlog story: As a Camper, I want to create a Booking for an eligible Trip so I can reserve participation and proceed to payment.

Acceptance Criteria:

| Source  | Criterion                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Camper can create a Booking only for a Trip that currently accepts registration.                                              |
| PB AC-2 | Booking creation validates booking deadline, Trip state, Weather Risk restrictions and available capacity where applicable.   |
| PB AC-3 | Booking price/amount is calculated from authoritative server data.                                                            |
| PB AC-4 | Booking and capacity reservation are consistent and atomic.                                                                   |
| PB AC-5 | Duplicate/retried creation must not create duplicate authoritative reservations.                                              |
| PB AC-6 | Successful Booking enters the applicable pre-payment/free-Booking lifecycle state defined by the authoritative Booking model. |

## 2. Scope

### In Scope

- Create Booking.
- Validate Camper.
- Validate Trip registration eligibility.
- Validate booking deadline.
- Validate risk block.
- Validate capacity.
- Calculate authoritative Booking amount.
- Reserve capacity.
- Establish Booking lifecycle.

### Out of Scope

- Adding detailed members; CTMS-030.
- Payment provider processing; CTMS-032.
- Booking cancellation; CTMS-034.
- Refund; CTMS-035.

## 3. Actors & Authorization

- Camper.
- System.

Booking belongs to authenticated Camper according to authoritative ownership model.

## 4. Preconditions & Dependencies

- Trip exists.
- Trip accepts registration.
- Camper authenticated/eligible.
- Booking deadline has not invalidated registration.
- CTMS-018 risk policy allows new registration.
- Capacity is available.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-082 | A Booking may be created only when the Trip is published, booking_deadline has not passed, the Trip has not started, the approved Route version remains eligible, Weather Risk is not Red, and sufficient capacity remains. The backend must revalidate all conditions inside the transaction immediately before reserving capacity.                                 |
| BR-083 | A Booking must snapshot the applicable Trip schedule at creation time, using starts_at/ends_at or equivalent snapshot fields, together with base_price and cancellation_policy, so later configuration changes cannot rewrite Booking history. For a free Trip, successful capacity reservation creates the Booking as confirmed with payment_status = not_required. |
| BR-084 | For a paid Trip, a new Booking must be created with status = pending_payment and payment_status = unpaid, with hold_expires_at determined by configuration. The Booking may move to confirmed only after the charge succeeds.                                                                                                                                        |

## 6. State & Lifecycle

No Booking
→ eligible create
→ authoritative initial Booking state.

Paid Trip:
→ applicable pre-payment state
→ CTMS-032 payment.

Free Trip:
→ follows authoritative free-Booking confirmation policy.

Exact enum names come from Booking domain model.

## 7. Business Flow

1. Camper selects Trip.
2. Camper starts Booking.
3. Backend identifies authenticated Camper.
4. Backend reloads authoritative Trip.
5. Validate Trip state.
6. Validate booking deadline.
7. Validate Weather Risk registration policy.
8. Validate capacity.
9. Calculate authoritative amount.
10. Create Booking and reserve applicable capacity atomically.
11. Persist initial Booking state.
12. Return Booking.
13. Paid Booking proceeds to CTMS-032.

## 8. Data & Invariants

- Booking belongs to authenticated Camper.
- Booking references correct Trip.
- Booking cannot bypass Red-risk registration block.
- Booking cannot exceed capacity.
- Price comes from server-authoritative source.
- Client cannot choose authoritative Booking status.
- Booking/capacity reservation is atomic.
- Retry cannot reserve the same intended Booking twice.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                           | Expected Behavior                        |
| ------------------------------ | ---------------------------------------- |
| Trip unavailable               | Reject.                                  |
| Deadline passed                | Reject.                                  |
| Red-risk block applies         | Reject.                                  |
| Capacity insufficient          | Conflict.                                |
| Client modifies price          | Server calculation wins.                 |
| Concurrent final-seat requests | Overbooking protection applies.          |
| Transaction fails              | No partial Booking/capacity reservation. |
| Duplicate retry                | No duplicate authoritative reservation.  |

## 11. Acceptance & Test Matrix

| Source          | Scenario                   | Expected Result                 | Test Type   |
| --------------- | -------------------------- | ------------------------------- | ----------- |
| PB AC-1, BR-082 | Eligible Camper/Trip       | Booking creation allowed        | E2E         |
| PB AC-2, BR-082 | Registration closed        | Rejected                        | Boundary    |
| PB AC-2         | Red risk                   | Rejected                        | Integration |
| PB AC-2, BR-083 | No capacity                | Rejected                        | Concurrency |
| PB AC-3, BR-084 | Client sends altered total | Server total used               | Security    |
| PB AC-4, BR-083 | Booking commit succeeds    | Capacity consistent             | Transaction |
| PB AC-5         | Request retried            | No duplicate reservation        | Idempotency |
| PB AC-6, BR-084 | Valid Booking created      | Correct initial lifecycle state | State       |

## 12. Open Decisions

Exact initial Booking status for paid/free Trips and exact payment-hold deadline must follow the authoritative Booking/Payment rules.

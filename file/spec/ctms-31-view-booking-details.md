# CTMS-031 — View Booking Details

## 1. Overview

Story: CTMS-031

Epic: EPIC 5. Booking and Payment

Use Case: View Booking Details

Priority: Must Have

Goal: Allow an authorized Camper or Host to view the Booking information required for the Booking workflow without exposing unrelated personal, medical, payment, or internal data.

Backlog story: As an authorized user, I want to view Booking details so I can understand the Booking, Trip, participant, payment, and applicable service information.

Acceptance Criteria:

| Source  | Criterion                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | An authorized Camper can view the details of their Booking.                                                     |
| PB AC-2 | An authorized Host can view Booking information required to operate their Trip.                                 |
| PB AC-3 | Booking Detail reflects authoritative Booking, Trip, member, payment and applicable add-on/equipment state.     |
| PB AC-4 | Sensitive or unrelated data must not be exposed beyond the actor's permitted scope.                             |
| PB AC-5 | Route/geometry or operational data referenced by the Booking is exposed only according to its visibility rules. |

## 2. Scope

### In Scope

- View Booking identity/code.
- View related Trip information.
- View Booking status.
- View payment status.
- View participant/member information permitted to the actor.
- View applicable add-ons/equipment.
- Apply actor-specific projection and data minimization.

### Out of Scope

- Editing Booking.
- Payment execution.
- Cancellation/refund.
- Member check-in.
- Direct access to unrelated Route/private data.

## 3. Actors & Authorization

- Camper: may view their own Booking.
- Host: may view Booking data required for a Trip they are authorized to operate.
- System: authoritative authorization and projection.

Backend must evaluate role, ownership and Trip/Booking business relationship.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-029.

Preconditions:

- Booking exists.
- Actor is authenticated where required.
- Actor has ownership or an approved business relationship to the Booking/Trip.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-089 | Booking Detail, when accessed by an authorized Camper or Host, must show the Booking code/id, Trip, schedule, members, amount/surcharges, equipment reservations, payment_status, and booking_status. It does not need to expose the Route entity. |
| BR-214 | Routes, checkpoints, hazard areas, and raw geometry are internal operational data for Host/Admin/System use. Camper APIs must not provide Route List/Route Detail or expose raw route_geom, checkpoint, or hazard-management data.                 |
| BR-048 | Trip membership is represented by bookings + booking_members. The system must not introduce a separate Trip Member entity as a second source of truth.                                                                                             |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                               |
| BR-173 | A user may view or modify only data they own unless the user's role and business relationship explicitly authorize access to another user's data.                                                                                                  |
| BR-186 | Personal and health data must be returned only as the minimum fields necessary for the business purpose and only to authorized actors.                                                                                                             |
| BR-201 | List-returning APIs must support pagination and enforce a maximum page size. Filtering and sorting are allowed only on documented fields.                                                                                                          |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                              |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                       |

## 6. State & Lifecycle

Read-only story.

Booking lifecycle is not mutated by viewing details.

Any state displayed must come from current authoritative Booking/payment/member state.

## 7. Business Flow

1. Actor requests Booking Detail.
2. Backend authenticates actor where required.
3. Backend loads Booking.
4. Backend evaluates ownership/Trip relationship.
5. Backend determines actor-specific projection.
6. Backend loads permitted related Trip/member/payment/add-on/equipment data.
7. Sensitive/unrelated fields are removed.
8. Booking Detail is returned.

## 8. Data & Invariants

- Booking status comes from authoritative Booking.
- Payment status is not inferred from client state.
- Camper cannot view another Camper's Booking without an approved relationship.
- Host receives only data required to operate the Trip.
- Raw payment credentials/provider secrets are never returned.
- Health information follows separate medical-consent authorization.
- Internal Route geometry is not automatically exposed.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                     | Expected Behavior                      |
| ---------------------------------------- | -------------------------------------- |
| Booking missing                          | 404/not-found semantics.               |
| Unrelated Camper                         | Do not expose Booking.                 |
| Unrelated Host                           | Do not expose Booking.                 |
| Booking changed since client loaded page | Return current authoritative state.    |
| Sensitive field not required by actor    | Omit it.                               |
| Related Route data is internal           | Do not expose internal representation. |

## 11. Acceptance & Test Matrix

| Source          | Scenario                               | Expected Result                       | Test Type     |
| --------------- | -------------------------------------- | ------------------------------------- | ------------- |
| PB AC-1, BR-089 | Camper opens own Booking               | Permitted detail returned             | E2E           |
| PB AC-2, BR-089 | Host opens Booking for own Trip        | Operational detail returned           | Authorization |
| PB AC-3         | Booking/payment state changes          | Current authoritative state displayed | Integration   |
| PB AC-4, BR-173 | Sensitive unrelated data exists        | Data omitted                          | Security      |
| PB AC-4, BR-186 | Medical data not authorized            | Not exposed                           | Security      |
| PB AC-5, BR-214 | Booking references internal Route data | Visibility policy applied             | Security      |

## 12. Open Decisions

Exact actor-specific Booking Detail DTO belongs to Technical Design/Data Dictionary.

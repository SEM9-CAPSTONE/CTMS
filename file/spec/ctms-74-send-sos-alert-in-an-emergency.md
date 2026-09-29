# CTMS-074 — Send SOS Alert in an Emergency

## 1. Overview

Story: CTMS-074

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Send SOS Alert in an Emergency

Priority: Must Have

Goal: Allow an eligible participant to quickly create an SOS alert containing the operational information required for emergency handling.

Backlog story: As a participant in an active Trip, I want to send an SOS alert quickly so the Trip's emergency handlers receive my emergency context.

Acceptance Criteria:

| Source  | Criterion                                                                       |
| ------- | ------------------------------------------------------------------------------- |
| PB AC-1 | Emergency action is easily accessible during active Trip.                       |
| PB AC-2 | SOS records sender.                                                             |
| PB AC-3 | SOS records Trip.                                                               |
| PB AC-4 | SOS records current or last available location.                                 |
| PB AC-5 | SOS records event time.                                                         |
| PB AC-6 | SOS records battery when available.                                             |
| PB AC-7 | SOS records emergency type.                                                     |
| PB AC-8 | Authorization/business-precondition failure produces no false SOS side effects. |

## 2. Scope

### In Scope

- SOS creation.
- Sender.
- Trip.
- Current/last location.
- Event time.
- Battery where available.
- Emergency type.
- Easy emergency access.

### Out of Scope

- Offline SOS queue — CTMS-076.
- Accidental SOS cancellation — CTMS-077.
- WebSocket delivery — CTMS-079.
- Host acknowledgement/closure — CTMS-080.

## 3. Actors & Authorization

- Eligible active Trip participant.
- System.

SOS must be associated with an authorized applicable Trip context.

## 4. Preconditions & Dependencies

- Active Trip context exists.
- User is eligible to send SOS for that Trip.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-254     | An SOS alert must record the sender, Trip, current/last known location, time, battery level when available, and emergency type. The emergency action must be easy to access during an active Trip.                                                                       |
| BR-211     | Any request rejected for authorization failure or an unmet business precondition must terminate before any state-changing commit and must not create side effects such as data updates, capacity holds, charges/refunds, notifications, or false business audit records. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                    |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                             |

## 6. State & Lifecycle

SOS created
→ active/open emergency handling.

Subsequent states such as acknowledged/closed are handled by CTMS-080.

Cancellation is separately governed by CTMS-077.

## 7. Business Flow

1. Participant activates SOS action.
2. Verify active Trip/participant context.
3. Obtain current location if available.
4. Otherwise use applicable last-known location.
5. Capture event time.
6. Capture battery if available.
7. Capture/select emergency type.
8. Persist SOS.
9. Trigger downstream emergency delivery.
10. Expose emergency status to applicable workflows.

## 8. Data & Invariants

SOS includes:

- sender;
- Trip;
- current/last location;
- time;
- battery when available;
- emergency type.

Location must not be fabricated.

Missing optional battery must not block legitimate SOS creation.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                          | Expected Behavior                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Current GPS available                         | Store current location                                                           |
| Current GPS unavailable but last known exists | Store last applicable location                                                   |
| Battery unavailable                           | SOS still allowed                                                                |
| Unauthorized Trip                             | Reject before SOS creation                                                       |
| Network unavailable                           | CTMS-076 offline workflow applies                                                |
| Repeated client request                       | Must not create unintended duplicate emergency records where idempotency applies |

## 11. Acceptance & Test Matrix

| Source | Scenario                 | Expected Result     | Test Type   |
| ------ | ------------------------ | ------------------- | ----------- |
| BR-254 | Valid active participant | SOS created         | E2E         |
| BR-254 | Current GPS exists       | Location recorded   | Integration |
| BR-254 | Battery unavailable      | SOS still created   | Boundary    |
| BR-254 | Emergency type supplied  | Stored              | Functional  |
| BR-211 | Unauthorized user        | No SOS/side effects | Security    |

## 12. Open Decisions

Emergency-type enum must come from authoritative data definition/configuration if not already fixed.

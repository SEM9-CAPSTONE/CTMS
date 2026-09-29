# CTMS-079 — Receive Real-Time SOS Alerts

## 1. Overview

Story: CTMS-079

Epic: EPIC 13. Real-Time Communication

Use Case: Receive Real-Time SOS Alerts

Priority: Must Have

Goal: Deliver newly persisted SOS alerts to an authorized Host through an established WebSocket connection within the defined real-time latency requirement.

Backlog story: As a Host, I want to receive SOS alerts in real time so I can react quickly to emergencies on Trips I manage.

Acceptance Criteria:

| Source  | Criterion                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------ |
| PB AC-1 | Authorized Host receives new SOS through WebSocket when connection is stable.                    |
| PB AC-2 | Delivery latency is <5 seconds from server acceptance/persistence of SOS to Host client receipt. |
| PB AC-3 | Unauthorized Host must not receive the SOS.                                                      |
| PB AC-4 | UI provides an attention signal.                                                                 |
| PB AC-5 | UI provides a way to acknowledge the SOS.                                                        |

## 2. Scope

### In Scope

- SOS WebSocket event.
- Authorized Host.
- <5-second delivery target.
- Attention signal.
- Acknowledge entry point.

### Out of Scope

- SOS creation.
- Acknowledge state mutation — CTMS-080.
- Push notification while app backgrounded — CTMS-090.

## 3. Actors & Authorization

- Authorized Host.
- WebSocket server.
- Host client.

Host must be authorized for the Trip associated with SOS.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-074/076.
- CTMS-078.

SOS has been accepted/persisted by server.

WebSocket connection is stable.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-260 | Under stable connectivity, an authorized Host must receive a newly accepted/persisted SOS over WebSocket in under 5 seconds, measured from server acceptance/persistence to client receipt. The UI must provide a clear attention signal and an acknowledgement action. |
| BR-259 | A WebSocket connection must validate the JWT, reject invalid or expired tokens, and join the user only to rooms they are authorized to receive.                                                                                                                         |

## 6. State & Lifecycle

SOS persisted
→ WebSocket event emitted
→ authorized Host client receives event
→ attention signal shown
→ Host may acknowledge through CTMS-080.

The WebSocket delivery itself does not mark SOS acknowledged.

## 7. Business Flow

1. Server accepts/persists SOS.
2. Resolve applicable authorized Trip room/Host recipients.
3. Emit SOS event.
4. Authorized connected Host receives event.
5. Measure delivery time.
6. Client displays prominent attention signal.
7. Client exposes acknowledge action.
8. Host acknowledgement invokes CTMS-080.

## 8. Data & Invariants

Latency metric:

`Host client received_at - SOS server accepted/persisted_at < 5 seconds`

under stable-connection test conditions.

Invariants:

- Receipt ≠ acknowledgement.
- Unauthorized Hosts receive nothing.
- SOS must be persisted/accepted before the latency measurement origin described by BR-260.

## 9. API / Integration Contract

WebSocket event schema: TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                    | Expected Behavior                                    |
| --------------------------------------- | ---------------------------------------------------- |
| Stable connection                       | Event delivered                                      |
| Unauthorized Host                       | No event                                             |
| Host disconnected                       | Real-time WebSocket guarantee does not falsely apply |
| Event displayed                         | Attention signal shown                               |
| Event received                          | SOS remains unacknowledged until explicit action     |
| Delivery >=5s under defined stable test | Performance AC fails                                 |

## 11. Acceptance & Test Matrix

| Source | Scenario              | Expected Result              | Test Type   |
| ------ | --------------------- | ---------------------------- | ----------- |
| BR-260 | Stable WebSocket      | SOS received                 | E2E         |
| BR-260 | Measure server→client | <5 seconds                   | Performance |
| BR-259 | Unauthorized Host     | No event                     | Security    |
| BR-260 | SOS received          | Attention signal             | UI          |
| BR-260 | SOS received          | Acknowledge action available | UI          |

## 12. Open Decisions

Performance test environment must define what qualifies as a stable connection, while retaining the <5-second metric defined by BR-260.

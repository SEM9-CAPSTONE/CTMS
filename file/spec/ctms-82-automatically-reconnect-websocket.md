# CTMS-082 — Automatically Reconnect WebSocket

## 1. Overview

Story: CTMS-082

Epic: EPIC 13. Real-Time Communication

Use Case: Automatically Reconnect WebSocket

Priority: Must Have

Goal: Restore real-time communication after an unexpected WebSocket interruption without creating duplicate subscriptions or missing eligible events.

Backlog story: As a user, I want the application to automatically reconnect when the WebSocket connection is interrupted so real-time features recover without manual intervention.

Acceptance Criteria:

| Source  | Criterion                                                                |
| ------- | ------------------------------------------------------------------------ |
| PB AC-1 | Client automatically attempts reconnection after WebSocket interruption. |
| PB AC-2 | Reconnection uses bounded backoff.                                       |
| PB AC-3 | Authentication and authorization are re-established as applicable.       |
| PB AC-4 | Authorized room subscriptions are restored.                              |
| PB AC-5 | Eligible missed events are recovered.                                    |
| PB AC-6 | Reconnection/recovery must not produce duplicate events.                 |

## 2. Scope

### In Scope

- Automatic reconnect.
- Bounded backoff.
- Authorized subscription restoration.
- Missed-event recovery.
- Duplicate prevention.

### Out of Scope

- Initial WebSocket authentication — CTMS-078.
- Business-specific SOS acknowledgement.
- Push notifications.

## 3. Actors & Authorization

- Authenticated client.
- WebSocket server.

Restored subscriptions must still pass current authorization.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-078.

A previously established WebSocket connection has been interrupted.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-263     | When a WebSocket connection drops, the client must reconnect using bounded backoff, restore authorized room subscriptions, and recover eligible missed events without duplication.    |
| BR-259     | A WebSocket connection must validate the JWT, reject invalid or expired tokens, and join the user only to rooms they are authorized to receive.                                       |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.          |

## 6. State & Lifecycle

`connected`
→ `disconnected`
→ `reconnecting`
→ authenticated
→ authorized subscriptions restored
→ missed events recovered
→ `connected`

Failed attempts remain within bounded retry/backoff behavior.

## 7. Business Flow

1. Client detects WebSocket disconnection.
2. Enter reconnecting state.
3. Wait according to bounded backoff.
4. Attempt authenticated connection.
5. Revalidate authorization.
6. Restore currently authorized room subscriptions.
7. Recover eligible missed events.
8. Deduplicate recovered/live events.
9. Return to connected state.

## 8. Data & Invariants

- Reconnection must not bypass authentication.
- Previous room membership is not sufficient proof of current authorization.
- Missed/live copies of the same event must not be displayed twice.
- Backoff must be bounded rather than increasing without limit.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                | Expected Behavior                                                |
| ----------------------------------- | ---------------------------------------------------------------- |
| Temporary disconnect                | Reconnect automatically                                          |
| Repeated failure                    | Bounded backoff                                                  |
| Authorization changed while offline | Restore only currently authorized rooms                          |
| Missed event recovered              | Display once                                                     |
| Same event also arrives live        | Deduplicate                                                      |
| Token invalid/expired               | Do not restore protected connection without valid authentication |

## 11. Acceptance & Test Matrix

| Source     | Scenario                       | Expected Result           | Test Type   |
| ---------- | ------------------------------ | ------------------------- | ----------- |
| BR-263     | Connection drops               | Reconnect starts          | Integration |
| BR-263     | Multiple failures              | Bounded backoff           | Reliability |
| BR-259/263 | Reconnect                      | Authorization revalidated | Security    |
| BR-263     | Authorized rooms               | Restored                  | Integration |
| BR-263     | Missed event                   | Recovered                 | E2E         |
| BR-263     | Duplicate recovered/live event | Display once              | Idempotency |

## 12. Open Decisions

Exact backoff parameters belong to Technical Design/configuration.

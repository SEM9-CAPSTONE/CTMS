# CTMS-078 — Establish Authenticated WebSocket Connection

## 1. Overview

Story: CTMS-078

Epic: EPIC 13. Real-Time Communication

Use Case: Establish Authenticated WebSocket Connection

Priority: Must Have

Goal: Establish a real-time connection only for authenticated users and restrict subscriptions/rooms to resources the user is authorized to receive.

Backlog story: As an authenticated user, I want a secure real-time connection so I receive only events I am authorized to see.

Acceptance Criteria:

| Source  | Criterion                                                      |
| ------- | -------------------------------------------------------------- |
| PB AC-1 | WebSocket connection validates JWT.                            |
| PB AC-2 | Invalid token is rejected.                                     |
| PB AC-3 | Expired token is rejected.                                     |
| PB AC-4 | User joins only rooms the user is authorized to receive.       |
| PB AC-5 | Authentication alone does not grant arbitrary Trip/role rooms. |

## 2. Scope

### In Scope

- WebSocket authentication.
- JWT validation.
- Invalid/expired rejection.
- Authorized room membership.

### Out of Scope

- SOS creation.
- SOS business lifecycle.
- Automatic reconnection — CTMS-082.
- Notification preferences.

## 3. Actors & Authorization

- Authenticated User.
- WebSocket gateway/server.

Authorization is evaluated for each applicable room/resource.

## 4. Preconditions & Dependencies

User has authentication credential/token.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-259     | A WebSocket connection must validate the JWT, reject invalid or expired tokens, and join the user only to rooms they are authorized to receive.                                                                                                                                                         |
| BR-170     | Any function requiring authentication may execute only when the user has a valid authenticated session and the account is in active status.                                                                                                                                                             |
| BR-171     | Any function requiring an active account must re-check account status on the backend at request time. pending_verification, suspended, or deleted accounts must be denied even when the client still holds an older access token/session, except for explicitly allowed verification or recovery flows. |
| BR-172     | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization.                                                                                                                    |

## 6. State & Lifecycle

Disconnected
→ connection request
→ token validation.

Valid + authorized:
→ connected
→ authorized rooms joined.

Invalid/expired:
→ rejected/disconnected.

## 7. Business Flow

1. Client requests WebSocket connection.
2. Present authentication credential.
3. Validate JWT.
4. Reject invalid/expired token.
5. Resolve user identity/roles/relationships.
6. Determine authorized rooms.
7. Join only authorized rooms.
8. Maintain connection until disconnect/invalid lifecycle event.

## 8. Data & Invariants

- Connected identity comes from validated authentication.
- Room membership requires authorization.
- Valid token does not imply access to every Trip/room.
- Invalid/expired token cannot receive protected events.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                            | Expected Behavior          |
| ------------------------------- | -------------------------- |
| Valid JWT                       | Authentication may proceed |
| Invalid JWT                     | Reject                     |
| Expired JWT                     | Reject                     |
| Valid JWT, unauthorized Trip    | Do not join Trip room      |
| Host authorized for Trip A only | No Trip B room             |
| Connection drops                | CTMS-082 handles reconnect |

## 11. Acceptance & Test Matrix

| Source | Scenario          | Expected Result          | Test Type     |
| ------ | ----------------- | ------------------------ | ------------- |
| BR-259 | Valid JWT         | Connection authenticated | Security      |
| BR-259 | Invalid JWT       | Rejected                 | Security      |
| BR-259 | Expired JWT       | Rejected                 | Security      |
| BR-259 | Authorized room   | Joined                   | Authorization |
| BR-259 | Unauthorized room | Not joined               | Authorization |

## 12. Open Decisions

WebSocket technology/provider and token-refresh handshake belong to Technical Design.

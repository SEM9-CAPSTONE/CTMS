# CTMS-065 — Reliable Synchronization After Reconnection

## 1. Overview

Story: CTMS-065

Epic: EPIC 10. Offline Buffer and Synchronization

Use Case: Reliable Synchronization After Reconnection

Priority: Must Have

Goal: Automatically synchronize pending GPS and safety data after connectivity returns without duplicate server records or loss of original event context.

Backlog story: As the System, I want pending offline data to synchronize reliably after reconnection.

Acceptance Criteria:

| Source  | Criterion                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| PB AC-1 | Pending GPS logs and safety events automatically synchronize after reconnection.                                 |
| PB AC-2 | Every item has pending, synced or failed synchronization state.                                                  |
| PB AC-3 | Sync preserves original event time, UUID, location, GPS accuracy and package/version context.                    |
| PB AC-4 | Server handles repeated UUID idempotently.                                                                       |
| PB AC-5 | Failed sync retries with bounded exponential backoff.                                                            |
| PB AC-6 | Retry does not block normal interaction.                                                                         |
| PB AC-7 | Already accepted item is not recreated.                                                                          |
| PB AC-8 | Sensitive medical data invalidated by revoked consent is not reauthorized through stale offline synchronization. |

## 2. Scope

### In Scope

- Automatic reconnect sync.
- GPS logs.
- Safety events.
- Sync status.
- Stable UUID.
- Idempotent server ingestion.
- Bounded retry.
- Exponential backoff.
- Original event context.

### Out of Scope

- Local detection.
- Sync-status UI — CTMS-067.
- Server dashboard projection — CTMS-066.

## 3. Actors & Authorization

- Mobile synchronization subsystem.
- Server synchronization endpoint.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-064.

Network connectivity has returned.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-243 | After reconnecting, pending GPS logs and safety events must synchronize automatically. Each item must have one of the states pending, synced, or failed. Synchronization must preserve client event_time, UUID, location, GPS accuracy, and package/version context so the server can reproduce the detection conditions.                                                           |
| BR-244 | Every GPS log and safety event must have a client-generated UUID. The server must process repeated uploads with the same UUID idempotently and must not create duplicate records/events.                                                                                                                                                                                            |
| BR-245 | Failed synchronization must retry with a bounded exponential backoff, must not block normal user interaction, and must not recreate items that the server has already accepted.                                                                                                                                                                                                     |
| BR-230 | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |
| BR-226 | Offline-capable features must clearly distinguish local pending data from server-confirmed synchronized data and must not present unsynced local data as authoritative server state.                                                                                                                                                                                                |

## 6. State & Lifecycle

`pending`
→ successful server acceptance
→ `synced`

or:

`pending`
→ sync failure
→ `failed`
→ retry
→ `synced` or remains failed according to retry policy.

Same UUID uploaded again:
→ existing authoritative result/no duplicate.

## 7. Business Flow

1. Connectivity returns.
2. Load pending/eligible failed items.
3. Prioritize according to approved sync policy.
4. Send stable UUID + original context.
5. Server validates request.
6. Server performs idempotent upsert/acceptance.
7. On success, mark local item synced.
8. On failure, mark failed.
9. Schedule bounded exponential-backoff retry.
10. Continue normal app operation.
11. Never recreate already accepted UUID.
12. Apply consent invalidation/purge where required.

## 8. Data & Invariants

Each synchronized event preserves:

- UUID;
- original event time;
- location;
- GPS accuracy;
- package/version context.

Synchronization state ∈:

- pending;
- synced;
- failed.

Stable UUID is the idempotency identity.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                               | Expected Behavior                                        |
| ---------------------------------- | -------------------------------------------------------- |
| Connection returns                 | Automatic sync starts                                    |
| Same UUID uploaded twice           | One server record                                        |
| Timeout after server accepted item | Retry same UUID; no duplicate                            |
| Sync fails                         | failed + bounded retry                                   |
| App remains in use                 | Retry does not block normal interaction                  |
| Consent revoked                    | Invalid medical content not resynchronized as authorized |

## 11. Acceptance & Test Matrix

| Source | Scenario                     | Expected Result                     | Test Type   |
| ------ | ---------------------------- | ----------------------------------- | ----------- |
| BR-243 | Reconnect with pending items | Auto-sync                           | E2E         |
| BR-243 | Sync succeeds                | synced                              | Integration |
| BR-243 | Sync fails                   | failed                              | Integration |
| BR-244 | UUID repeated                | No duplicate                        | Idempotency |
| BR-245 | Failure repeated             | Exponential bounded retry           | Retry       |
| BR-245 | Retry running                | UI remains usable                   | E2E         |
| BR-230 | Consent revoked              | Sensitive data remains inaccessible | Security    |

## 12. Open Decisions

Exact retry count/backoff durations are not stated in the retrieved BR; Technical Design/configuration must define them without changing the bounded exponential-backoff requirement.

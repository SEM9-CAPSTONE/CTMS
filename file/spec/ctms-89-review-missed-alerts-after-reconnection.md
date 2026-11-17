# CTMS-089 — Review Missed Alerts After Reconnection

## 1. Overview

Story: CTMS-089

Epic: EPIC 15. Notifications

Use Case: Review Missed Alerts After Reconnection

Priority: Must Have

Goal: Recover eligible unread or missed alerts after reconnection without duplicates while preserving the original event time.

Backlog story: As a user, I want to review alerts I missed while disconnected so temporary network loss does not hide important events.

Acceptance Criteria:

| Source  | Criterion                                                           |
| ------- | ------------------------------------------------------------------- |
| PB AC-1 | After reconnection, client retrieves eligible unread/missed alerts. |
| PB AC-2 | Duplicate alerts are not displayed.                                 |
| PB AC-3 | Original alert/event time is preserved.                             |
| PB AC-4 | Only alerts eligible for the user are recovered.                    |

## 2. Scope

### In Scope

- Reconnect recovery.
- Eligible unread alerts.
- Missed alerts.
- Deduplication.
- Original event time.

### Out of Scope

- WebSocket reconnection algorithm — CTMS-082.
- Notification generation.
- Background push.

## 3. Actors & Authorization

- Authenticated user.
- Notification/recovery subsystem.

Recovered alerts remain subject to current authorization/eligibility.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-082.
- CTMS-088.

Client has reconnected after an interruption.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-272 | After reconnecting, the client must retrieve eligible unread/missed alerts, avoid duplicate presentation, and preserve the original alert/event time.                              |
| BR-263 | When a WebSocket connection drops, the client must reconnect using bounded backoff, restore authorized room subscriptions, and recover eligible missed events without duplication. |

## 6. State & Lifecycle

Disconnected
→ events occur
→ reconnect
→ fetch eligible unread/missed alerts
→ deduplicate
→ display using original event time.

## 7. Business Flow

1. Client reconnects.
2. Authenticate/revalidate user.
3. Request eligible unread/missed alerts.
4. Server resolves applicable alerts.
5. Preserve original event timestamps.
6. Client/server deduplicate against already received events.
7. Display remaining missed alerts.

## 8. Data & Invariants

- Original event time must not be replaced by reconnect time.
- Same event must not appear twice because it was received through both live and recovery channels.
- Recovery does not bypass current access rules.

## 9. API / Integration Contract

The existing WebSocket replay returns `events`, `latestSequence` and `truncated`.
Replay has a default 24-hour retention and a default 200-event response limit across all event types.
After a truncated replay, including a cursor outside retention, Camper clients use the same HTTP backfill flow.

`GET /api/missed-alerts?cursor=<opaque cursor>` requires an authenticated Camper.
It returns `items`, `nextCursor`, `failedSources` and `recoveryMode: "backfill"`.
WebSocket replay has no `recoveryMode` field. The HTTP snapshot covers the 24 hours
before the first request and returns at most 200 items per page across all sources.
Ordering is `occurredAt` descending and `dedupKey` ascending. The cursor is signed,
account-bound, and expires 24 hours after the snapshot starts. Missing credentials
return 401, missing Camper role returns 403, and an invalid or expired cursor returns 422.
Restart without a cursor after a 422. On partial failure, hold the current cursor,
retain successful items and merge the same page again when retrying. Pagination resumes
when all sources succeed.

Each item has `source`, `sourceId`, `dedupKey`, `occurredAt` and `details`.
Deduplicate using `<source>:<sourceId>`.

| Source | Identity and timestamp | Details and visibility |
| --- | --- | --- |
| `broadcast` | Live and replay `broadcastId`, with original `createdAt` | Trip ID, alert type and content. Camper must be an original recipient and a current eligible member. |
| `sos` | Live and replay `transitionId`, with audit `occurredAt` | SOS ID and one of the audited cancellation, acknowledgement or closure actions. Only the SOS sender can backfill them. |
| `notification` | Live and replay `notificationId`, with original `occurredAt` | Event type and `readAt` for the authenticated recipient. Use the existing inbox API for authorized target details. CTMS-379 currently produces Host/Admin trip-review notices. |

For notifications, `readAt: null` means unread. Broadcast and SOS omit the field.
Legacy SOS replay entries can lack the audit ID. Keep their opaque replay identity
unless a transition match is verified. An old replay entry and its backfill counterpart
can therefore temporarily appear twice. Audit actors, notes and raw snapshots are excluded from backfill.

## 10. Error & Edge Cases

| Case                               | Expected Behavior               |
| ---------------------------------- | ------------------------------- |
| Alert occurred offline             | Recovered                       |
| Already received alert             | Not duplicated                  |
| Alert arrives live during recovery | Deduplicate                     |
| Original alert old                 | Preserve original event time    |
| User no longer eligible            | Do not expose unauthorized data |

## 11. Acceptance & Test Matrix

| Source | Scenario                     | Expected Result         | Test Type   |
| ------ | ---------------------------- | ----------------------- | ----------- |
| BR-272 | Reconnect after missed event | Alert recovered         | E2E         |
| BR-272 | Same alert already received  | No duplicate            | Idempotency |
| BR-272 | Recovered alert              | Original time preserved | Data        |
| BR-272 | Ineligible alert             | Not exposed             | Security    |

## 12. Open Decisions

None.

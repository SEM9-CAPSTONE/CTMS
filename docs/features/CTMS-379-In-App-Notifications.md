# CTMS-379 — Receive In-App Notifications — Preparation + Logic

## Scope

Jira subtask CTMS-379 implements the backend for Story CTMS-279 (spec CTMS-088).
The initial event catalog is `trip.review.requested`, `trip.review.reminder`, and
`trip.review.auto_rejected`. The existing booking-cancellation inbox and its API
remain separate; this module does not create a second cancellation notification.
UI CTMS-380, missed-alert recovery CTMS-381, preferences, and background delivery
are outside this change.

## Persistence and delivery

`in_app_notifications` stores one row per eligible recipient and source event:
`id`, `recipient_id`, nullable `trip_id`, `event_type`, `source_key`, `occurred_at`,
`created_at`, nullable `read_at`, and nullable `delivered_at`.

The source key combines Trip identity, the persisted submission audit UUID, and
event type. Both submission paths produce that audit inside their transaction.
Pending Trip edits do not change the submission identity; resubmission creates a
new audit UUID. Legacy/imported pending Trips without a submission audit fall back
to the review-window timestamp used by the existing deadline. That timestamp is
captured before auto-rejection changes the Trip.
`UNIQUE(source_key, recipient_id)` and `ON CONFLICT DO NOTHING` prevent duplicate
inbox rows under source retries or competing instances. Reminder audit exclusion
is scoped to the current review window, rather than the lifetime of the Trip.
Reminder processing rechecks status and window under the Trip row lock.

Both submission paths (stored-waypoint submit and waypoint configuration),
deadline reminder, and automatic rejection enqueue within their owning TypeORM
transaction. Rollback removes the inbox/outbox row. Existing Trip lifecycle rules,
24-hour deadline, and one-hour reminder lead time are unchanged.

The same committed row serves as the delivery outbox. Every five seconds the
worker processes up to 20 rows, locks each with `FOR UPDATE SKIP LOCKED`, checks
current content/recipient authorization, and emits to its recipient's private user
room. Failed delivery leaves the row pending. Invalidated recipients/targets are
suppressed and completed without emitting. `IN_APP_NOTIFICATION_WORKER_ENABLED=false`
disables automatic delivery; test environments invoke `runOnce()` explicitly.

Delivery is **at least once**, not exactly once: a process can stop between socket
emission and marking the row delivered. Retries reuse the notification UUID as
`meta.eventId`; consumers must deduplicate it. `delivered_at` means dispatch was
attempted successfully to the socket room, not that a device acknowledged receipt
or the user read it. Offline recipients still have the durable HTTP inbox.

## HTTP contract

All routes use the existing active-user JWT authentication. Recipient identity
comes exclusively from the authenticated request; no client recipient field exists.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/in-app-notifications` | Own inbox, newest first |
| GET | `/api/in-app-notifications/unread-count` | `{ unreadCount: number }` for this inbox |
| PATCH | `/api/in-app-notifications/:id/read` | 204; preserves first `readAt` on retries |

List query: `limit` defaults to 20 and is bounded 1–100; optional `state=read|unread`;
optional opaque `cursor`. Response: `{ items: NotificationView[], nextCursor: string | null }`.
Pagination orders by `(created_at DESC, id DESC)` and preserves PostgreSQL
microseconds in the cursor. Read filtering does not affect the unread-count endpoint.

Each view contains `id`, `eventType`, `occurredAt`, `createdAt`, `readAt`,
`targetAvailable`, and nullable `target`. Dates are UTC ISO strings. An accessible
target is `{ type: "trip", tripId, title, action: "review" | "view" }`.
This is a semantic reference, not an arbitrary URL. CTMS-380 maps it only to
supported screens; destination APIs continue to enforce their own authorization.
Read operations are explicit; listing, resolving, or receiving realtime does not
mark a notification read.

Invalid query validation returns 400; an invalid cursor returns 422. An unknown
notification and another user's notification both return 404 when marking read.
Unauthenticated/inactive accounts cannot use the API. Responses contain Vietnamese
feature error messages; shared authentication/validation errors retain their
existing contracts and must be localized by the presentation layer.

## Authorization and unavailable targets

New review requests/reminders select active Admins using the same role-assignment
precedence as `UsersRepository`: explicit assignments override the legacy role.
Automatic rejection selects only the active owning Host with the Host role.

Every list/delivery resolves current permissions. An Admin who lost the Admin role,
a Host who no longer owns the Trip/holds the Host role, or a deleted Trip cannot
resolve the target. The recipient's historical inbox metadata/read state remains,
but `target=null`, `targetAvailable=false`, with no Trip title or ID exposed.
Deleting a Trip nulls its foreign key without deleting the notification history.
Deleting a recipient cascades their notifications.

## Realtime contract

Event: `notification.created`. First argument:
`{ notificationId: string, occurredAt: string }`; second argument uses existing
`RealtimeEventMeta` with stable `eventId=notificationId`.

This is an inbox invalidation: CTMS-380 refetches the list/count and resolves current
authorization through HTTP. No Trip title/reference is retained in the replayable
realtime payload, preventing stale recovery data from bypassing content permission
changes. This event does not enqueue background pushes. Existing domain realtime
event names and payloads are preserved for current consumers. The legacy
`trip.review.auto_rejected` audience is narrowed to the owning Host's user room,
matching BR-301 and the existing Host-only web handler; it no longer targets the
Admin role room.

## Verification and boundaries

Task integration tests use a separate PostgreSQL test database with the existing
safety guard. They cover commit visibility/rollback, both actual submission paths,
concurrent source retries and delivery workers, reminder rounds, automatic
rejection, recipient isolation, read idempotency, permission revocation, and cursor
precision. Related Trip review and booking cancellation tests provide regression.
Unit tests cover invalid cursors, redaction, generic 404, and private realtime routing.

No development seed or UI changes are required. Jira links currently place the UI
and missed-alert story before the backend; implementation follows the approved
backend-first sequence without modifying Jira. Exact events beyond this initial
catalog remain a product/spec decision.

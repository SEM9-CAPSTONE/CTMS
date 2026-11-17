# CTMS-380: In-app notifications UI

## Scope

Web Host/Admin inbox integrated into the existing notification bell. The backend contract is supplied by CTMS-379. Mobile UI and CTMS-381 delivery recovery are excluded.

Base: `f5fd71de` on `develop`.

## Behavior

- The Trip group uses the backend unread count, cursor pagination, and structured targets. The existing activity group retains its existing recent-list count behavior; its count is not a new authoritative lifetime count.
- Opening the panel does not mark notifications read. Clicking an accessible notification navigates immediately and requests the read update. Failed updates retain the server's unread state and show the existing error toast.
- Admin review targets load directly by Trip ID, independently of the review list page. An unavailable target exposes neither its ID nor a link.
- Queries are keyed by account. Realtime creation, reconnection, window focus, and periodic refresh revalidate the inbox/count. Loaded pages are revalidated together, with a visible-row anchor used to preserve scroll position.
- Existing domain listeners remain responsible for notification toasts; the inbox does not add a second creation toast.
- The badge is hidden at zero and capped visually at `99+`. Unknown counts are not displayed as zero.

## Local preview data

Only `services/api/src/seeds/main.seed.ts` contains preview fixture creation. It reuses existing primary Host/Admin accounts and the Host's existing Hai Van route. Existing fixture Trips are skipped to retain user changes and read states.

Run the narrow seed mode without resetting the database:

```sh
pnpm --filter @ctms/api exec ts-node --transpile-only src/seeds/main.seed.ts --in-app-notifications-only
```

## Preview evidence

Evidence is local and ignored under `test-results/ctms-380/`:

- `01-admin-inbox-real-api.jpg`: Admin inbox with cursor pagination.
- `02-admin-open-page-two-real-api.jpg`: a Trip opened from the second notification page; unread count confirmed from 23 to 22 after the backend accepted the read update.
- `03-admin-unavailable-real-api.jpg`: unread unavailable target with no navigation link.
- `04-host-inbox-real-api.jpg`: Host automatic-rejection and unavailable-target notifications.

These screenshots use the running local API and database, not intercepted responses.

### Review clarification and additional evidence

The unavailable first item in each initial inbox is an intentional main-seed fixture: its `source_key` has the internal `ctms-380-unavailable:` prefix and its `trip_id` is NULL. It is not the Trip visible behind the popover. The API correctly returns `targetAvailable=false` and `target=null`. The Host's other automatic-rejection notification retains an accessible Trip target. No availability rule was changed.

The sidebar moderation badge counts pending work across moderation queues. The bell counts unread notifications, including read history independently of pending work; these numbers are not expected to match.

- `05-host-actions-real-api.jpg`: explicit open indicator and individual read buttons.
- `06-host-legacy-real-api.jpg`: existing departure notices in the activity group. No booking-cancellation notice was available in this local account, so this image does not establish that particular source's regression result.
- `07-host-empty-real-api.jpg`: empty unread activity group.
- `08-admin-new-delivery-real-api.jpg`: a new main-seed submission appears without manual refresh, with the badge increasing from 22 to 23. The database confirms the durable worker delivered it and recorded `notification.created`. This is a delivery smoke check, not an isolated proof excluding the polling fallback.
- `09-admin-network-error-real-api.jpg`: actual local API connection failure. The development API was briefly stopped, then restarted. Cached rows remain visible with a Vietnamese retry message. The panel recovered automatically after reconnection.
- `10-admin-load-more-real-api.jpg`: first-page load-more control.
- `11-admin-page-two-target-real-api.jpg`: opens the second-page Trip directly after the latest UI changes.
- `12-admin-read-confirmed-real-api.jpg`: after reading the loaded pages through the real PATCH endpoints, the unread group is empty and the zero badge is hidden. Escape closes the panel.

Available rows now show an explicit open label. Every unread row has its own keyboard-accessible read button, including rows without an accessible target.

## Validation status

- Web Vitest: 300/300 files and 1,991/1,991 tests passed after updating the legacy notification tests.
- API Jest: 232/232 suites and 2,848/2,848 tests passed.
- Web TypeScript and git diff checks passed.
- Repository Biome check found the same 16 errors and 12 warnings as the clean base.
- The reviewer confirmed that Retry reloads the notifications after the API recovers.
- The failed read state was verified in a component test. No desktop screenshot was captured for this case.

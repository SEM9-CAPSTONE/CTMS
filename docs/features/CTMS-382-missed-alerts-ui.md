# CTMS-382 — Camper missed alerts

The Camper Trip detail screen uses the existing broadcast section and a recovery
section immediately below it. A broadcast already rendered above is excluded from
the recovery section by its original broadcast ID. The recovery section is
account-wide and can include SOS updates and alerts from other eligible Trips.
The newest unseen broadcast appears in the emergency banner only. Acknowledging
it moves its content into history. The recovery section is hidden after a
successful load when all its rows are already rendered in the broadcast section.

Flutter fetches `GET /api/missed-alerts` on screen entry, foreground resume and
network restoration. A single request runs at once. Automatic foreground refreshes
within ten seconds of a completed fetch are skipped. Connectivity restoration
can retry immediately. Flutter does not have a WebSocket client for this flow.
The `realtime.resume`, `truncated`, and `recoveryMode` fields are not used by Flutter.

The server supplies a rolling 24-hour snapshot and a cursor for up to 200 alerts
per page. Results are keyed by `dedupKey` and sorted by original time descending
and key ascending. Original time is displayed in device local time. New records
from an automatic refresh can be staged behind “Xem cảnh báo mới” while existing
entries stay on the screen. Notification unread copy is shown only for explicit
`readAt: null`. Older SOS replay events without an audit identity may overlap
with HTTP recovery when WebSocket replay is added.

On a partial response, the client merges available rows and retries the current
page before advancing. On an expired cursor, it starts at the first page and
keeps displayed rows while merging. On a normal first-page refresh, previously
loaded broadcast rows absent from a successful broadcast response are removed
until confirmed again by a subsequent page. The existing Trip broadcast list
clears on an authorization failure. The recovery controller is replaced on
account changes and drops responses after disposal.

## Local verification

The implementation is on `feat/CTMS-382-review-missed-alerts-after-reconnection-ui`,
based on `d954a6ce`. Android debug build and installation succeeded using local
Pub-cache compatibility adjustments for fllama (optimized ProGuard defaults,
installed NDK 28.2, and installed CMake 3.22.1). Those environment-only changes
are outside this branch and must be considered when reproducing the local build.

The primary Host sent a real local broadcast at 15:59 on 17 November 2026 to two
recipients in the ongoing Son Tra Trip. The captured Host confirmation is stored
under the ignored `test-results/ctms-382/host-broadcast-sent.jpg`. The user's
Camper screenshot established the empty state. The Android window capture/control
tool timed out, so airplane-mode recovery on the emulator has not yet been
verified end to end.

Focused controller tests cover partial failure retry, expired cursors, reconnect
deduplication, staged new records, revoked broadcast removal, throttling, and
dropping in-flight results after disposal. The widget regression checks inline
loading, retry and deduplication against the existing broadcast section.

Final uncommitted-code checks:

- `flutter test --no-pub`: 652/652 tests passed.
- `flutter analyze --no-pub`: no issues found.
- `pnpm lint:all`: passed, with 10 Web warnings and zero errors.
- `pnpm build:all`: API and Web production builds passed.
- `git diff --check`: passed.

Full workspace test results from the unchanged `d954a6ce` backend/web baseline
remain 233/233 API suites (2,850 tests) and 300/300 Web files (1,991 tests).
They were not rerun for this Flutter-only change. The reviewer confirmed received content, original time, and before/after acknowledgement on Android. Automated airplane-mode recovery evidence
remains pending, so these checks do not establish the complete manual E2E scenario.


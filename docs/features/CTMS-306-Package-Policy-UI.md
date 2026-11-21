# CTMS-306 — Offline package policy UI

Story: Jira CTMS-242 / specification CTMS-057. Backend contract: CTMS-305.

## Approved scope

Mobile Camper/Porter package controls plus a minimal owning-Host web inbox are
included. The Host web addition was explicitly approved to close CTMS-305's
notification presentation gap; the Jira subtask only says client UI. No Jira
comments, ticket creation or scope edits are performed by this implementation.

The repository uses Flutter/Riverpod on mobile and React/TanStack Query on web;
generic EHub/React/Prisma guidance is followed only where it matches the actual
stack. Neither app currently configures an i18n runtime, so Vietnamese copy follows
existing app conventions without introducing a new framework.

## Activation boundary

1. Download the exact package selected by policy; required UUID and version must
   both match returned metadata, even when latest is a different publication.
2. Validate actual local hash and manifest before any verified/active report.
3. Persist an account/device/exact-artifact pending activation record. Send the
   downloaded, verified and active reports to CTMS-305 in order.
4. Only after server acceptance, revalidate local bytes and commit local activation.
   Preserve the previous active artifact until that commit. Cancellation/account
   changes stop the local commit.
5. Network failure retains verified bytes and the pending marker. Reopening,
   reconnecting or resuming re-enters finalization from the download journal,
   revalidates bytes and replays idempotent reports. This is foreground retry,
   not an OS background worker or a guarantee of delivery while the app is closed.

Readiness shown locally is distinct from departure authorization. A valid local
hash does not prove current sources. Server verification does not attest to bytes
on the device. Unknown source evidence remains unknown; server UTC checkedAt is
display-only and device time never determines source freshness.

AC1's update time means immutable package-content generation/update time:
`context.selected.updatedAt` for the same selected UUID, otherwise the pinned local
metadata's `generatedAt`. It is not download time or activation time. The short UI
label is "Cập nhật gói". Mobile uses the `timezone` package's explicit IANA
`Asia/Ho_Chi_Minh` location; web uses Intl with the same timeZone. Both format
dd/MM/yyyy HH:mm, without seconds or a timezone suffix, independently of the device
timezone. Formatting never determines freshness. Secondary timestamps use 14px
text in #334438 on white (AA contrast).

Ongoing/terminal policy disables replacement controls and retains the local active
artifact. Missing server lock evidence is not inferred as proof that latest is
active. Only an assigned Porter can confirm one installation through the server;
no requirement means no confirmation action. Group status is read-only.

## Host notification presentation

Use existing authenticated list/read APIs and existing Trip detail/status reads.
Queries are account scoped, refresh on open/focus and poll every 60 seconds. Each
notice includes Trip title and departure time. Active/history classification is
per Trip; different Trips are not ordered into one global blocking episode.
Cancelled/completed Trip notices are labelled resolved, omitted from unread count,
and do not produce a blocking banner. A cached blocking response cannot override
an authoritative terminal Trip prop/status. Reading a live notice does not unblock
a published Trip. No push transport is introduced.

The Trip detail page only adds the owner-visible departure status component.
Its operations panel, cancellation handler, cancellation endpoint and Porter
management are unchanged. Existing cancellation tests are outside CTMS-306 evidence.

## Local saved-content map

The Route tab reuses the existing map canvas with route/checkpoints from the
verified exact active version and the local verified MBTiles sidecar. It displays
numbered stops and the same saved checkpoint list; it does not auto-confirm
arrivals or invent GPS. The local reader does not initialize or call an API client.
Account switch, permission denial and artifact mismatch fail closed. Missing
approved survival guidance keeps the truthful empty state.

### Final evidence scope and review follow-up (13 November 2026)

The current HTML/ZIP contains 23 screenshots: five saved-content views from the
normal app, sixteen production-widget Android integration cases, and two Host
web content-region screenshots. There are no simulated gallery screenshots,
cancellation screenshots or cancellation-response JSON in this bundle. The
existing cancellation E2E is skipped and excluded from CTMS-306 evidence; the
operations panel, cancellation handler/endpoints and Porter management remain
unchanged. A departure banner reads current Trip status and stays hidden for
cancelled/completed Trips; resolved notices do not count toward the unread badge.
No new mutation is attached to the cancellation flow.

The final mobile run used real API port 3000 and the existing development DB ctms,
explicitly authorized by the user. Only the guarded demo Trip ending 141 was
changed; Host notification evidence uses a separately guarded demo ending 151.
Package versions and requirements were created by opt-in main.seed.ts helpers.
These helpers do not create new dev accounts. Freshness remains unknown; approved
safety guidance is not fabricated. The manual ongoing fixture is not evidence of
successful live departure; the separate 27-case PostgreSQL integration suite
covers transactional worker locks with controlled source/artifact fixtures.

The transport harness requires CTMS306_EVIDENCE=1, refuses CI, and normally accepts
only ctms306_capture_test. A dev run additionally requires the distinct
CTMS306_ALLOW_DEV_EVIDENCE=1 flag. Android evidence requires the explicit Dart
CTMS306_EVIDENCE=true define; without it, this manual integration test is skipped.
It is not part of default CI. It modifies only demo identities after checking the
name/status and restores membership after revocation. It creates immutable test
artifacts and updates the demo requirement; these mutations are disclosed rather
than presented as read-only testing. The proxy drops real requests or corrupts
one byte only for labelled failure cases. Successful responses are never mocked.
The green header dot is not an assertion that this per-Trip API is reachable.
The evidence-only title is confined to integration_test, not lib/production UI.

Mobile labels now name the candidate version (for example Gói v3: Chưa tải) while
retaining the active v1 separately. A zero-byte journal uses Bản cần dùng, never
Gói trên thiết bị. Optional v2 uses a neutral row explicitly saying không bắt buộc;
amber is reserved for a mandatory candidate. Porter has one reason adjacent to
the disabled button: downloading, pending sync, missing version, or unknown/expired
freshness. A mandatory badge identifies the version without repeating the load
instruction. Old readiness error messages are hidden during download, sync and
ongoing. Cached unknown is never presented as current data.

Host inbox entries include the authorized Trip title and start time fetched from
existing APIs. Active/historical state is per Trip, not global creation-time order;
newer notices belonging to another Trip do not supersede an older active block.
Cancelled/completed Trips are labelled resolved and excluded from unread totals.
Host has web UI only; the Android Host-token probe exists solely to exercise the
actual 403 role guard. Notifications are fetched on open/focus/poll, not pushed.
The final dev overview check returned HTTP 200 with no overview error visible.

Schema/seed disclosure: pending additive migrations 1794900000000,
1795000000000 and 1795100000000 were applied to the dev DB before real-device
policy testing (see the local migration log and pre-change backup). CTMS-306 adds
no new migration. The earlier CTMS-305 no-seed statement does not apply to this
branch: this branch changes only main.seed.ts for additive opt-in demo setup.
The contract keeps one active report per Trip/user/device. When v3 activates,
Porter v1 becomes verified, retaining its history/hash rather than another active
record. Retry upserts the same unique package/device report.

Final validation: 583/583 mobile unit/widget tests; 56 web component tests in four
files (the prior 54 included one cancellation-panel scenario removed from scope;
three notification/terminal-state tests were added, with cancelled and completed named separately); one Android real-API lifecycle
integration test; one Host notification/read-state E2E on the real dev API. The
27 worker tests are a separate backend integration scope, not UI coverage or live
freshness proof. Earlier 41/67/122/570 counts are historical subsets/runs, not
additive totals. Do not assert the earlier weather failure is pre-existing: it
was not reproduced against develop. Remote CI and whole-repository E2E remain
unverified; do not tick their checkboxes or call the task complete before PR CI.

Known effects and limits: CTMS-119 still owns freshness; live source remains
unknown. Revoked participants cannot open local data under CTMS-054. The real
404 probe revokes only the demo Camper membership temporarily; the 403 probe
uses a disallowed role. Host web notification support closes CTMS-305's ownership
gap and is explicitly included although Jira says UI. No push, override,
cancellation behavior or Porter-management changes are introduced. Evidence HTML,
JSON, screenshots and ZIP remain outside Git.

### Final wording follow-up

A failed candidate now gives the Porter reason “Tải lại bản vN”; both failure and
pending sync use “Gói cũ vẫn dùng được”. Pending sync does not repeat its status
above the disabled confirmation button. An online latest package without a
requirement is labelled “Bản mới nhất”, not a mandatory version. Readiness is
intentionally evaluated before the scheduled start; Host headings now say
“Chưa sẵn sàng khởi hành” without changing the backend gate or lifecycle rules.
The Host evidence region excludes the existing English upload component, which
remains outside this task. Component tests explicitly cover both cancelled and
completed Trips suppressing a cached blocking response. Final web count is 56
(the previous 55 plus the separate completed case); mobile count is 583 after three departure-reminder terminal-state tests.

The Host notification fixture was corrected to use a due departure time through
the opt-in main seed. The real schedule worker only evaluates due Trips; an
earlier screenshot had called the gate directly before the start as fixture
setup. The neutral readiness heading must not imply that the worker automatically
creates early-departure notifications. No production time predicate was changed.

## Final notification presentation

The mobile package card does not embed the global Porter unread counter or inbox link.
All departure reminders are hidden for ongoing, completed and cancelled Trips.
A rejected confirmation (409) rolls back and creates no notification. A committed
locking gate persists a changed reason and enqueues notices under CTMS-305.
Host web refreshes every 60 seconds, on opening and on window focus. Terminal Trip
notice exclusion is performed in the web presentation using authorized Trip status.
CTMS-306 main-seed demo helpers require CTMS306_DEMO_SEED=1 (default off) and
reject production. Final revision adds three mobile terminal-state tests (583 total).

## Remaining Porter inbox gap and Host request fan-out

CTMS-306 does not expose departure notifications in the Porter mobile inbox.
The bell is unwired; Porter sees only reasons on the package card. CTMS-305
persists the notifications, but mobile presentation requires a follow-up ticket.
Jira creation is blocked by the connector site grant; a local ticket draft exists.
Host enrichment groups by distinct Trip ID. Per poll it requests one inbox plus
two resources per distinct Trip: 1 + 2U, up to 101 GETs for 50 distinct Trips.
There is no cross-poll enrichment cache or batch API. A service test verifies 50
notices for one Trip result in three GETs. Final web focused scope is 57 tests.

## Final whole-repository gates — 2026-11-13

`pnpm lint:all` passed (Web 0 errors/12 warnings; API passed).
`pnpm build:all` passed for Web and API.
`pnpm test:all` passed: API 198 suites/2,405 tests, Web 263 files/1,780 tests,
AI 34 tests. The focused 57 Web tests are a subset of 1,780, not additional tests.
Required remote CI and whole-repository E2E remain unverified. The Porter inbox
presentation gap is open; no task-complete claim is made.

## Additional final integration verification

Four PostgreSQL suites (package policy/worker, generation, access and basemaps):
64 tests passed in `ctms306_final_test`. Generation/download API E2E: 39 tests in
two suites passed in the same isolated test DB. The 27 worker tests are a subset
of 64, not an additional count. Android standalone integration and Host Playwright
E2E each passed against real HTTP modules using the repository fixture server and
`ctms306_host_review_test`. Source freshness stays unknown; no approval was invented.
The Android test was corrected for current rejection copy and aligned to the
repository's shared test fixture. No production code changed during this pass.

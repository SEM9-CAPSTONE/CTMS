# CTMS-414: View Host and Porter Reputation – UI

Base: `b6a216d1`, after CTMS-413 / PR #923.

## Scope and contract

- Flutter Camper: Host reputation in published Trip details and booked Trip details.
- Existing web Camper Trip details: Host reputation beside the organizer.
- Web Host: Porter reputation on current assignments and pending owned invitations.
- Flutter CTMS-390: reputation from current assignments and the caller's retained review context.
- Host/Admin management is web-only in the existing Flutter role router.

The Host invitation API supplements CTMS-413 with `porterDisplayName` in the
existing list query. It adds no contact fields or new authorization scope.
The backend change is a separate commit.

Only server-provided numeric aggregates are shown. One decimal is rounded
half-up using the number's decimal representation and a Vietnamese comma.
The count always accompanies a numeric score. `{ratingAverage:null,ratingCount:0}`
means “Chưa có đánh giá”; an absent block is hidden. A retained Porter review
does not infer reputation from a current assignment.

Refresh failures from transport/5xx retain the last snapshot with “Chưa cập nhật”
and a retry. 401/403/404 clear the previous snapshot. Viewer changes clear scoped
memory/cache and discard outstanding responses. No new score cache is persisted.

The API has no authorized AI insights projection for these contexts. Jira's
conditional AI insight presentation remains open pending that data source;
this UI does not generate insights or replace numeric ratings.

## Local evidence

The default main seed automatically includes the reputation scenarios after the
existing account, route and review steps. No additional flag is needed when
initializing the full local dataset.

To add only these scenarios to an existing local database, use the same main seed:

```powershell
cd services/api
node -r ts-node/register src/seeds/main.seed.ts --reputation-only
```

This additive local-only path reuses existing Host/Camper/Porter accounts and
one existing additional Porter, when present. It preserves existing bookings,
transactions, notes, ratings and revisions on reruns. It only normalizes the
known legacy Host/numbered Porter names for the selected people.

- “Sơn Trà – Bình minh trên đỉnh Bàn Cờ”: current assignments, rated and unrated.
- “Sơn Trà – Dạo bước dưới tán rừng”: the caller's review after assignment removal.
- “Sơn Trà – Hẹn mùa lá mới”: pending invitations with display names.

Android evidence is opt-in:
`integration_test/reputation_real_screenshots_test.dart`.
It uses a real API login and server data; its session stays in memory so that
secure-storage migration is not part of the reputation test. The refresh-failure
case injects only a transport error, retaining the preceding real API snapshot.
A real review edit verifies a new aggregate, then restores the original rating
through another revision. Images distinguish real API states from injected faults.

The Host web shell intentionally blocks phone viewports below its existing
desktop breakpoint. CTMS-414 preserves that rule; supported narrow desktop
layout and enlarged text are checked separately.
All three Host Porter views group the title with the back button on the left;
the shared header sticks to the top while scrolling. The reputation refresh
action remains on the right in the assigned view.

## Validation workflow

Run focused backend integration/unit, web component/hook and Flutter widget tests
before UI review. Capture API evidence for UI approval before running repository
gates. Record each command, base commit and exact pass/fail totals in the PR.
Do not tick a failed or unexecuted gate.

### Verified results (2026-11-19)

Base: `b6a216d1` (PR #923). The invitation-name supplement is commit
`3a86e9fe`; UI and seed changes were verified on top of it.

- `pnpm lint:all`: pass, 0 errors and 10 existing web warnings.
- `pnpm build:all`: pass for web and API; existing Vite chunk-size warning remains.
- `pnpm test:all`: web 304/304 files and 2,016/2,016 tests pass; AI 34/34
  tests pass; API 239/240 suites and 2,957/2,960 tests pass. The command exits 1
  on three existing danger-zone transition assertions, so its checkbox stays open.
- `flutter test --no-pub --concurrency=2`: 699/699 tests pass.
- `flutter analyze --no-pub`: no issues.
- Focused API integration: 47/47 tests; Porter-request unit tests: 40/40.
- Android real-API evidence scenario: 1/1 passes, including restoring the review
  after the aggregate-update check. Evidence comprises six Android and eight web images.
- `git diff --check`: pass. No dependency lockfile change is included.

The API failures expect DETECTED to transition to UNDER_REVIEW and reject
CONFIRMED/DISMISSED. They reproduce on the previously checked baseline
`49cf589e`. Both the proposal test module and its imported hotspot transition
implementation are unchanged from that baseline through `b6a216d1` and this
branch. No unrelated transition logic was edited.

The first parallel gate attempt exhausted local memory. Final gate runs use
`NODE_OPTIONS=--max-old-space-size=2048` and
`npm_config_workspace_concurrency=1`; the full-test retry also inherits a two-CPU
process affinity. No test configuration was changed. Web took 1,268.37 seconds
and API took 113.653 seconds on this local run.

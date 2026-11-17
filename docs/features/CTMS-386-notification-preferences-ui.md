# CTMS-386 — Configure General Notification Types — UI

## Scope

Base: `1fd585bc` (PR #913, CTMS-385). Flutter Camper profile and Porter settings
reuse the existing push device status card and add a shared preferences card.
Story CTMS-282 and subtask CTMS-386 describe an authenticated user without
explicitly naming Host/Admin screens. The approved delivery scope is Flutter
Camper/Porter. Host/Admin web preferences UI is not included; the API already
supports all authenticated roles. Jira remains read-only.

## Interaction contract

- Server catalog, configurability, labels, version and effective settings are
  authoritative. Initial loading/errors never fabricate enabled switches.
- The card is titled **Cài đặt thông báo** and explains that these controls apply
  to phone notifications while in-app history is retained.
- Changes remain local until **Lưu tùy chọn**. An unchanged form sends no PATCH.
  Saving disables duplicate saves and toggles. Only a confirmed response clears
  the draft and shows success through the existing ScaffoldMessenger mechanism.
- A `409` blocks saving until an explicit reload. Reload preserves draft choices
  for categories that remain configurable. The user reviews and explicitly saves
  against the new version. There is no automatic overwrite or retry of writes.
- Network failures preserve choices. `422` requires catalog reload. Technical
  messages are not displayed verbatim.
- Locked emergency/SOS categories remain visible and disabled, with a lock label
  for accessibility. Weather explains that Red alerts remain mandatory.
- Preferences affect future push delivery passes; in-app history is unchanged.
  Existing OS permission/device registration status remains visible separately.
- Account changes dispose the controller and cancel HTTP calls. GET/PATCH use
  the existing expected-account guard, including during authentication refresh.

## Verification on uncommitted CTMS-386 worktree

Commands run from `apps/mobile` unless indicated otherwise:

- `flutter analyze --no-pub lib/features/notification_preferences lib/core/api/api_client.dart`
  passed after correcting two brace-style infos.
- `dart analyze lib/features/notification_preferences lib/core/api/api_client.dart test/features/notification_preferences_test.dart`
  passed with no issues.
- `flutter test --no-pub test/features/notification_preferences_test.dart test/core/api/api_client_test.dart`
  passed: **2 files, 16/16 tests** (8 new preference tests, 8 API client regressions).
  Initial run failed in the two new widget tests because ListTile ink was hidden
  by the section background; fixed with a local Material ancestor and reran.
- `flutter run --no-pub -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3001/api`
  built the debug APK. Existing Firebase/fllama Kotlin plugin migration warnings
  remain; no plugin or SDK workaround was added in this task.
- `git diff --check` passed (repository root).

The user verified that the Camper settings loaded from the local API, that a
saved booking preference persisted when reopening the profile, and that the
latest APK shows **Đã lưu cài đặt thông báo.** after saving. Camper screenshots
are stored in the Git-ignored `test-results/ctms-386/` directory. A real-API
two-session conflict, network failure during save, and Porter screen were not
verified on the emulator. Automated tests cover conflict and save failure.

### Pre-push checks after the final copy update

The checks ran on the uncommitted CTMS-386 worktree based on `1fd585bc`.

- `flutter test --no-pub test/features/notification_preferences_test.dart test/core/api/api_client_test.dart`: 2 files, 16/16 tests passed.
- `flutter analyze --no-pub lib/features/notification_preferences lib/core/api/api_client.dart test/features/notification_preferences_test.dart`: no issues.
- `flutter test --no-pub`: 668/668 tests passed (81 test files under `apps/mobile/test`).
- `flutter build apk --debug --no-pub --dart-define=API_BASE_URL=http://10.0.2.2:3001/api`: passed. APK installed on `emulator-5554`.
- `pnpm lint:all`: passed (10 web warnings, 0 errors).
- `pnpm build:all`: passed (API and web).
- `pnpm test:all`: exit 1. API passed 235/235 suites and 2,864/2,864 tests.
  AI passed 34/34 tests. Web passed 299/300 files and 1,990/1,991 tests.
  The failure was `HostWeatherDecisionCard > locks the form once an Admin acted,
  shows the pause and the decision log` in `WeatherDecisionComponents.test.tsx:190`.
- `pnpm --filter @ctms/web exec vitest run src/features/weather-decisions/components/WeatherDecisionComponents.test.tsx -t 'locks the form once an Admin acted'`
  reproduced the same failure in 3/3 attempts. Git reported no diff from
  `1fd585bc` for web source/config, root package scripts, or workspace lockfile.
  The fixture captures Trip start timestamps independently while the component
  requires exact timestamp equality. Logs are in Git-ignored `test-results/ctms-386/`.

### Local API port correction

The first device review showed the initial-load error. Direct HTTP inspection
found that port 3001 still served an older process without this endpoint (404),
while the current backend ran on port 3000. The bootstrap reads `API_PORT`, not
`PORT`. After identifying the worktree processes, restarted the current API with
`API_PORT=3001 pnpm --filter @ctms/api exec ts-node --transpile-only src/main.ts`.
An unauthenticated GET to `/api/notification-preferences` then returned 401,
confirming route registration. Authenticated Camper review succeeded afterward.

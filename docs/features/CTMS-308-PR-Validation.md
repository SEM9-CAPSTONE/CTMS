# CTMS-308 PR validation — 2026-11-10

Branch: `feat/CTMS-308-view-current-location-on-offline-map-ui`.
Validation covers the current working tree, including uncommitted UI and test changes.

| Check | Result |
| --- | --- |
| BE Jest unit | PASS: 191 suites, 2,310 tests |
| BE Nest build | PASS |
| BE ESLint | PASS |
| BE all PostgreSQL integration | FAIL: 68 suites passed / 7 failed; 775 tests passed / 39 failed |
| Related integration after test-contract correction | PASS: 5 suites, 80 tests |
| BE all HTTP/module E2E | FAIL: 3 suites passed / 1 failed; 58 tests passed / 5 failed |
| Offline HTTP/module E2E | PASS: 2 suites, 39 tests |
| Mobile full Flutter tests | PASS: 460 tests |
| Mobile analyze | PASS: no issues |
| Android debug APK build | PASS, local API `http://10.0.2.2:3000/api` |
| Web TypeScript + Vite build | PASS, bundle-size warnings |
| Web ESLint | PASS: 0 errors, 12 warnings |
| Web Vitest (thread pool) | PASS: 259 files, 1,731 tests |
| Route preparation Node tests | PASS: 5 tests |
| OSM raster Python tests | PASS: 5 tests |
| `git diff --check` | PASS |

## Commands (repository root unless cwd noted)

```powershell
node services/api/node_modules/jest/bin/jest.js --config services/api/jest.config.js --runInBand
# services/api cwd:
node node_modules/@nestjs/cli/bin/nest.js build
node node_modules/eslint/bin/eslint.js src
$env:TEST_DATABASE_URL='postgresql://ctms:ctms@127.0.0.1:55451/ctms_test'
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand
# apps/web cwd:
node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1 --reporter=verbose
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
node node_modules/eslint/bin/eslint.js .
# apps/mobile cwd:
flutter test --no-pub -r expanded
flutter analyze --no-pub
flutter build apk --debug --no-pub --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
# repository root:
node --test services/api/scripts/offline-basemap-policy.test.cjs
python scripts/test_build_osm_raster.py
git diff --check
```

Jest commands used an ignored workspace `--cacheDirectory` to avoid temporary
cache access failures. PostgreSQL integration/E2E use only the disposable test
database on port 55451, not the application database or demo trip.

## Findings and corrections

- Updated the offline download HTTP test fixture to register the added basemap
  dependency. Offline E2E now passes; production dependency registration was
  already present.
- Updated GPS context integration assertions to verify the server-provided start
  and end timestamps against the actual fixture row. The full integration run
  above precedes this test correction; only the five related suites were rerun.
- Other failing integration suites: review analysis (response contract and
  cleanup FK restrictions), trip reviews (image upload), incident reporting
  (authorization expectation), route checkpoint editing (422), synchronization
  evaluation (500), overbooking evaluation (fixture duration constraint).
  These modules were not changed as part of this validation. The later develop
  comparison below reproduced all 38 remaining candidate failures on develop.
- All-BE E2E failures are in `trips.images.e2e-spec.ts` (5 tests). No unrelated
  image/business logic was modified to make the run green.
- Full integration completed and printed its summary, then retained open handles;
  the finished runner was interrupted after capturing its results.
- Initial Web Vitest attempts had no visible test progress and were interrupted;
  this alone does not establish a deadlock. The completed passing run uses the
  thread pool with verbose reporting (786.92 seconds).

Web Playwright E2E was not run: the default configuration reuses the application's
port-3000 backend and does not isolate its database. Specialized browser E2E
configurations and required remote CI checks are not covered by the passing
workspace commands below. No production/browser acceptance claim follows from
unit tests alone.

Logs are retained locally under `artifacts/pr-*.log`; do not add unrelated
artifacts or large binary map data to the PR. UI evidence is the user-provided
`2026-11-10 22-43-20.mp4` (emulator GPS and fixture route).


## Develop comparison follow-up

Compared the seven failing integration suites against fresh origin/develop
`f0631abf` on separate fresh test databases. All 38 remaining candidate failures
have the same failed test identities on develop; no candidate-only failure.
Develop additionally fails the outdated GPS context expectation that was fixed
on the candidate. Trip images E2E passes 20/20 independently on both branches,
so its earlier five full-run failures were not reproduced. See
[comparison details](CTMS-308-Develop-Comparison.md) for commands and limits.


## Workspace commands — final results recorded 2026-11-11

The commands themselves ran to completion, rather than merely equivalent
per-package commands. Logs retain their original run timestamps on 2026-11-10.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm lint:all` | PASS | API/Web completed; Web 0 errors, 12 warnings |
| `pnpm build:all` | PASS | API Nest build and Web TypeScript/Vite build completed |
| `pnpm test:all` | PASS | API 191 suites / 2,310 tests; Web 259 files / 1,731 tests; AI 34 tests |

Final logs: `artifacts/dod-lint-all.log`, `artifacts/dod-build-all.log`,
`artifacts/dod-test-all.log`. Final Web duration in the workspace run: 875.01 s.

Windows Vitest configuration now selects the same thread pool as the earlier
verified standalone run, with verbose reporting so redirected workspace logs show
progress. Other platforms retain the fork pool and default reporter. No tests
were skipped or assertions relaxed by this runner configuration. Earlier
no-output attempts were interrupted; silence alone did not establish a deadlock.

The recursive pnpm commands include packages with corresponding scripts. They
do not include Flutter or BE integration/E2E commands. Flutter's separate
460-test/analyze/APK results and the integration/E2E results above still apply.
The passing `test:all` does not turn the full integration/E2E failures green.

### Repository Story 058 acceptance evidence

| AC in `file/spec/ctms-58-view-current-location-on-offline-map.md` | Evidence |
| --- | --- |
| Current GPS visible offline | User clip 22-43-20, offline map after re-entry |
| Downloaded route visible | Route overlay remains after airplane mode |
| Downloaded checkpoints visible | Checkpoint markers/list remain after airplane mode |
| GPS accuracy shown | Offline map displays GPS ±5 m (Tốt) |

Evidence uses an emulator GPS location and fixture route. This is not a real
field navigation validation or proof of the production upstream safety adapter.

### DoD status for PR

- UI/client behavior: implemented; local unit/component and related E2E checks pass.
- Backend integration: demo package/basemap HTTP flow integrated; authoritative
  production safety-source dependency remains explicitly documented.
- Repository Story 058 four AC: supported by the supplied emulator video.
- Unit regression and `lint:all`/`build:all`/`test:all`: PASS.
- Whole-repository E2E regression: do not mark PASS; full-run image failures
  were not reproduced in the isolated develop comparison.
- Required CI checks: pending a PR run of the final pushed commit.


## Confirmed image E2E root cause — 2026-11-11

Reproduced on isolated `ctms_e2e_cause_20261111_test`:
1. Run `trips.images.e2e-spec.ts` on fresh DB: 20/20 PASS.
2. Run `trip-form-drafts-migration.integration-spec.ts`: 3/3 PASS.
3. Inspect `to_regclass('public.trip_form_draft_images')`: NULL.
4. Run the same image E2E again: 15 PASS / 5 FAIL, with missing-table errors.

The migration test sets `search_path` to its private schema followed by `public`.
Its `afterEach` runs unqualified `DROP TABLE IF EXISTS trip_form_draft_images`.
For test cases without a local images table, PostgreSQL resolves that name to
the public table and deletes it. The application's migration history still
records the creation migration as applied, so later E2E startup does not recreate
the missing table. Draft-image API calls return 500.

This confirms test cleanup contamination, rather than an image upload failure
caused by the offline-map implementation. The test exists on develop as well.
The repair should schema-qualify cleanup statements (or remove public fallback
for destructive operations). No production code or test cleanup was modified
in this diagnostic step. Logs: `artifacts/e2e-cause-before.log`,
`artifacts/e2e-cause-migration.log`, `artifacts/e2e-cause-after.log`.


## Cleanup repair verified — 2026-11-11

Cleanup in `trip-form-drafts-migration.integration-spec.ts` now explicitly
qualifies both DROP TABLE statements with the private test schema. No production
code changed. Reproduction on fresh `ctms_e2e_cleanup_fix_20261111_test`:

- Trip images before migration test: 20/20 PASS.
- Migration tests: 3/3 PASS.
- `public.trip_form_draft_images` still exists after cleanup.
- Complete BE E2E after migration test: **4 suites, 63/63 PASS**, exit 0.
- Biome and `git diff --check`: PASS.

Runs used `--forceExit` after reporting results because open handles remain a
separate test-runner concern. This result supersedes the earlier five image E2E
failures. It does not claim Web Playwright E2E or remote CI checks passed.
Logs: `artifacts/cleanup-fix-before.log`, `artifacts/cleanup-fix-migration.log`,
`artifacts/cleanup-fix-e2e-all.log`.

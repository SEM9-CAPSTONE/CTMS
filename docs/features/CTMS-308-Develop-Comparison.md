# Develop comparison — 2026-11-10

Baseline: `origin/develop` at `f0631abf` (fetched before running).
Candidate: current CTMS-308 working tree, including the corrected GPS contract assertion.
Two separate fresh databases on isolated test PostgreSQL port 55451:
`ctms_baseline_compare2_test` and `ctms_candidate_compare2_test`.
Same installed dependency tree and copied local configuration; DATABASE_URL is
explicitly overridden to the respective test DB by the test setup.
No application/demo database was used. Baseline tracked files remain unchanged.

| Check | develop | Current UI |
| --- | --- | --- |
| Seven previously failing integration suites | 70 pass, 39 fail | 71 pass, 38 fail |
| Trip images E2E run separately after those suites | 20 pass, 0 fail | 20 pass, 0 fail |

All **38 candidate integration failures have the exact same test identities on
develop**. No new failed test identity appears only on the candidate in this
comparison. The one develop-only failure is the GPS context test's outdated
exact-object expectation, now corrected to verify the start/end timestamps
against the database on the candidate.

The five image E2E failures from the earlier full run did not reproduce in this
isolated comparison on either branch. They cannot be labelled a proven product
regression or a confirmed pre-existing product defect. They remain a full-run
ordering/environment/isolation concern requiring separate diagnosis.

Scope: this compares the seven failing integration suites and the one failing
E2E suite, not every test on develop or every possible runtime interaction.
These results support that the observed remaining integration failures are also
present on develop; they do not prove absolute absence of indirect effects.

## Failure counts shared by both branches

- Review analysis: 26
- Trip reviews: 1
- Incident reporting: 1
- Route checkpoint editing: 2
- Synchronization evaluation: 4
- Overbooking evaluation: 4

## Reproduction

Use each branch's API cwd with its respective fresh TEST_DATABASE_URL:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --forceExit --json --outputFile RESULT.json --testPathPattern 'review-analysis.integration-spec|gps-tracking.integration-spec|trip-reviews.integration-spec|incidents.report.integration-spec|trekking-route-checkpoints.integration-spec|sync-evaluation.integration-spec|overbooking-evaluation.integration-spec'
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --forceExit --json --outputFile IMAGES.json --testPathPattern trips.images.e2e-spec
```

`--forceExit` was used after results because the preceding full integration run
retained open handles. Workspace cache directories were supplied to each run.
JSON and raw logs are local `artifacts/compare-{develop,ui}-*.{json,log}`.
The detached baseline worktree is `artifacts/baseline-develop-20261110`.


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

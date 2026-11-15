# CTMS-391 — Report Inaccurate Information or Dangerous Content: Preparation + Logic

## Scope and sources

Jira subtask CTMS-391 belongs to Story CTMS-285 / specification CTMS-094. CTMS-392 owns UI and must use its own branch. Implementation extends the existing content-report storage and Admin API; it does not modify Route/Trip workflows, moderation transitions, review visibility rules or review analysis logic.

Sources: repository AGENTS, `.agents/AGENTS.md`, user-supplied CTMS workflow prompt, README, project/Git guides, architecture, CTMS-094 and CTMS-105 specs, Trip/Host review implementation and moderation contract, existing content-report code/tests. Generic E-Hub/Prisma instructions do not match CTMS's TypeORM architecture; no Prisma, i18n framework or new dependency was introduced.

LD approved the report catalog, duplicate policy and target authorization in chat on 2026-11-15. The executable API contract is recorded in section 13 of `file/spec/ctms-94-report-inaccurate-information-or-dangerous-content.md`. No separate teammate spec sign-off is claimed.

## Implementation

- `ReportSubmissionController` serves authenticated owner routes under `/api/me/content-reports` separately from the existing Admin controller.
- `ReportSubmissionService` checks current account state, replays a prior key, validates current target access, persists the report and audits creation atomically.
- `ReportSubmissionRepository` contains parameterized SQL. Shared locks protect reviewer identity, Trip ownership and participating member rows during submission. No Route/Trip state is written.
- Request DTO validates stable type/target codes, UUIDs, trimmed description and length. Global whitelist validation rejects spoofed reporter/status.
- Migration adds nullable submission metadata and database constraints without changing existing primary keys, reasons, states or timestamps.
- Existing Admin response includes an optional `reportType` only for classified submissions. Existing report states and processing logic remain untouched.

## Migration deployment check

Run a read-only check before applying the migration:

```sql
SELECT reporter_id, target_type, target_id, count(*)
FROM content_reports
WHERE status IN ('pending', 'reviewing')
GROUP BY reporter_id, target_type, target_id
HAVING count(*) > 1;
```

If rows exist, have an authorized Admin resolve the redundant open cases through the existing workflow. Do not delete or automatically change history to make the index succeed. A read-only check of the current local development and test databases found zero such groups during implementation; no development migration or seed was run by this task.

### Deployment checklist (per environment)

- [ ] Confirm the target environment/database and record the preflight operator, time, and result in the deployment record.
- [ ] Run the query above on staging before applying the migration. Staging has not been checked by this task.
- [ ] If duplicates exist, stop deployment; obtain authorized moderation decisions for the open cases, then rerun the preflight. Never resolve, delete or rewrite reports automatically to satisfy the index.
- [ ] Apply the migration on staging and verify both unique indexes and the submission CHECK constraint.
- [ ] Smoke-test authorized submission, retry, open-target conflict, owner status tracking and Admin review on staging.
- [ ] Repeat the preflight on production immediately before its migration. A staging/local result is not proof of production readiness.

Neither staging nor production access, migration execution, or deployment approval is claimed here.

## UI handoff

- Map `inaccurate_information` and `dangerous_content` to natural Vietnamese labels.
- Generate one UUID v4 idempotency key for a submission and preserve it across retries. A deliberate new submission gets a new key.
- HTTP 409 `REPORT_ALREADY_OPEN` means another case is still being reviewed; `REPORT_IDEMPOTENCY_CONFLICT` means the key was reused with different content.
- Missing/inaccessible target: HTTP 404 `REPORT_TARGET_NOT_FOUND`. Missing/another owner's report: HTTP 404 `REPORT_NOT_FOUND`.
- Do not present a submitted report as content removed, confirmed dangerous, or moderation completed.
- Do not display internal report/target UUIDs, hashes or keys. Use the known content context and report timestamp. Use existing success/error toasts.
- Owner lists are paginated and contain only reports from the new submission workflow. Legacy reports remain in the Admin workflow.
- CTMS-392 must not describe this owner list as a complete history of all legacy reports, combine it with the Admin queue, or infer a legacy report type. An empty list means no reports in this supported workflow. Include this expectation in its UI acceptance tests; returning legacy reports requires a separately approved contract change.

## Verification

- API unit tests: 226 suites / 2,743 tests passed, including 21 new submission service/DTO tests.
- Submission integration: 27 tests passed using real PostgreSQL in `ctms_test`. Covers both type codes, primary-account reuse, target authorization, departed/self reporters, spoofed JWT role claims, owner privacy, concurrent retries with identical/changed payloads, concurrent distinct keys, terminal-state re-reporting, rollback on audit failure, database CHECK constraints and migration over a legacy row.
- Existing Admin content-report integration: 53 tests passed. Existing Trip/Host review and Host moderation integration: 38 tests passed. The latter two suites require local storage for their image fixtures; an initial run inherited Cloudinary configuration, then passed when `CLOUDINARY_CLOUD_NAME` was blank only in the test process. No production upload code or test assertion was changed.
- Existing Admin content-report UI component: 25 tests passed.
- `pnpm lint:all`: passed with 10 warnings in unrelated web files; API lint, task Biome and TypeScript checks passed.
- `pnpm build:all`: passed; Vite retains its large-chunk warning.
- AI workspace's configured test script: 34 tests passed (deprecation/cache warnings only).
- Review-analysis baseline failures were reproduced from clean origin/develop source. LD subsequently authorized a test-only fix on 2026-11-15: assert that rating equals the original Camper score, clean suite-owned moderation dependencies before review revisions, restore missing migration-defined worker slots in the guarded test database, and close the test application in finally. Runtime analysis/moderation code was not changed. The corrected suite passed 29/29 tests; the combined report-submission, Admin content-report and review-analysis run passed 3 suites / 109 tests (test-results/ctms391-report-analysis-final.json).
- Initial whole-web attempts failed with native allocation errors. On 2026-11-15, LD subsequently supplied a terminal screenshot of a completed `pnpm test:all` invocation: web 281 files / 1,887 tests passed, API 2,743 tests passed, and the command returned to the PowerShell prompt without a failure summary. This later result is user-provided evidence, not another agent-executed run. The AI workspace output is not visible in that screenshot; its separate 34-test passing run is recorded above. `test:all` does not include PostgreSQL integration/E2E or Flutter tests. Remote CI remains pending.

Results are under ignored `services/api/test-results/`; the source snapshot was moved to ignored `services/.test-cache/ctms391-baseline` outside the API Jest root to prevent duplicate test discovery. None is staged. No remote CI, commit, push or PR is implied by local test results.

### Reproduce the local-storage regression check (PowerShell)

Run from `services/api` with the repository's guarded test-database configuration. Use a single space rather than an empty string: Windows PowerShell may remove an environment variable assigned an empty string, allowing dotenv to reload credentials from .env. UploadsService trims the single space and chooses local storage. This changes only the test environment and restores the shell value afterward:

```powershell
$previousCloudName = $env:CLOUDINARY_CLOUD_NAME
try {
    $env:CLOUDINARY_CLOUD_NAME = ' '
    node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --testPathPattern 'trip-reviews.integration-spec|trip-review-moderation-host.integration-spec'
} finally {
    if ($null -eq $previousCloudName) {
        Remove-Item Env:CLOUDINARY_CLOUD_NAME -ErrorAction SilentlyContinue
    } else {
        $env:CLOUDINARY_CLOUD_NAME = $previousCloudName
    }
}
```

### Required PR disclosures and review follow-ups

- [ ] Include the pending staging/production preflight checklist above in the PR/deployment handoff.
- [ ] Ask the teammate responsible for the specification to review section 13 of CTMS-094, specifically duplicate handling, eligibility after departure and self-reporting. Chat approval by LD is recorded; teammate sign-off remains pending.
- [ ] Include the authorized test-only review-analysis repair and the combined 109-test result in the PR. Earlier baseline reproduction is historical evidence; the suite now passes. No separate notification has been sent.
- [ ] Preserve the distinction between the later user-provided passing `test:all` evidence, the separate integration results and the earlier memory-failed attempts. Include the local-storage command above so the 38-test regression result is reproducible.
- [ ] Run and record remote CI after a PR exists. Remote CI is pending and is not replaced by the local results.

Suggested PR caveat text (English):

> CTMS-391 task-specific tests pass locally. The previously reproduced review-analysis baseline failures were corrected with an authorized test-only update; runtime business logic is unchanged. The combined report/analysis integration run passed 109 tests across 3 suites. Missing worker-slot seed rows are restored idempotently only after the test-database safety check. The two image regression suites passed with CLOUDINARY_CLOUD_NAME blank in the test process (command above). Early whole-web attempts hit native allocation failures; LD subsequently supplied a completed test:all screenshot showing 281 web files / 1,887 tests and 2,743 API tests passed. This is user-provided local evidence; remote CI remains pending. Staging/production duplicate preflight and teammate review of CTMS-094 section 13 remain pending. The owner report list intentionally excludes legacy reports.

### Logic DoD

- [x] Approved submission logic and database invariants implemented.
- [x] Task-specific unit tests passed.
- [x] Task-specific real PostgreSQL integration tests passed.
- [x] Specification/API and UI handoff documented.
- [x] Related report/analysis integration regression passed (3 suites / 109 tests).
- [ ] Remote CI passed (not run).

# CTMS-385 — Configure General Notification Types — Preparation + Logic

Base commit: `783d6704`. The implementation remains uncommitted until requested.

## Contract

The authoritative API contract is in
`file/spec/ctms-91-configure-general-notification-types.md`, section 9.
The shared catalog supports ordinary booking, Porter assignment and weather push
preferences for all authenticated roles. Default values are enabled at collection
version zero. SOS and emergency remain locked under the existing policy. Red
weather is mandatory according to the backend event policy.

`GET /api/notification-preferences` reads a coherent version/value snapshot.
`PATCH /api/notification-preferences` serializes writes on the account's version
row. Requests with a stale version fail with 409. A partial category update is
atomic and preserves categories omitted from the request.

The worker loads preferences once per claimed delivery batch and checks each
ordinary recipient using that snapshot. There is no cross-batch cache. Changes
committed after a batch's snapshot apply to the next delivery pass. Lookup errors
default ordinary pushes to enabled and are logged. Existing mandatory rows bypass
preference filtering. Inbox creation and missed-alert recovery keep their existing
behavior. CTMS-386 should label its settings as push notifications.

## Verified behavior

The PostgreSQL integration group covers default values, version locking and
concurrent first writes, atomic invalid/locked category rejection, user isolation,
re-enabling weather, and account-deletion cascades. Push regression verifies that
disabling ordinary weather does not suppress mandatory Red weather or emergency
pushes. Existing SOS, broadcast, push and inbox integration tests are included.

Commands executed on the uncommitted CTMS-385 implementation:

- `pnpm --filter @ctms/api exec tsc --noEmit`: passed.
- `pnpm --filter @ctms/api exec jest --runInBand notification-preferences.service.spec.ts push-notifications.service.spec.ts push-notification.policy.spec.ts`: 3/3 suites, 33/33 tests passed.
- `pnpm --filter @ctms/api test:integration notification-preferences.integration-spec.ts`: 1/1 suite, 5/5 tests passed.
- `pnpm --filter @ctms/api test:integration notification-preferences.integration-spec.ts push-notifications.integration-spec.ts in-app-notifications.integration-spec.ts sos-realtime-delivery.integration-spec.ts emergency-broadcasts.integration-spec.ts`: 5/5 suites, 48/48 tests passed with `TEST_DATABASE_URL` targeting the separate `ctms385_regression_test` database.
- `pnpm lint:all`: passed, with 10 Web warnings and zero errors.
- `pnpm build:all`: passed for Web and API.
- `pnpm test:all`: API passed 235/235 suites and 2,864/2,864 tests. Web passed 300/300 files and 1,991/1,991 tests.
- `git diff --check`: passed.

The first grouped integration run on the existing shared test database failed
7 inbox tests (41/48 tests passed). Recipient queries encountered three unrelated
active Admin fixtures, affecting recipient and delivery counts. A new isolated
inbox test database passed 16/16 tests, then the complete group passed 48/48 on
the separate regression test database. The development database was not reset.

Jira still records CTMS-385 as blocked by UI CTMS-386. The implementation order
provides the backend contract before the UI. Jira was accessed read-only.

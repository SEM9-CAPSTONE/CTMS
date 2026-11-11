# CTMS-222 / CTMS-053 — Offline package download

Implemented on 2026-11-08 against the CTMS-053 specification, Jira CTMS-222 and the previous task discussion. User local runs passed the HTTP, Flutter feature and PostgreSQL authorization suites. Native device acceptance and verification with the real upstream package pipeline remain pending.

## Delivered behavior

- A separate NestJS download module consumes the CTMS-052 READY service without adding generation controls. Metadata and exact-version byte endpoints authorize the current confirmed Booking member or assigned Porter on each request. Host/Admin alone, removed members, cancelled Bookings, wrong Trips and revoked assignments have no bypass.
- Private byte transport implements full 200, single-range 206, authorized 416, strong SHA-256 ETag/If-Range and exact size/range headers. No storage key or internal provenance is returned. The existing generator verifies bounded private artifacts before serving bytes.
- Flutter uses authenticated Dio streaming with the existing refresh interceptor, private account-scoped files and Riverpod. The UI shows size/version/byte progress and pause/continue/retry. An interrupted `.part` resumes from actual filesystem length after re-authorizing the immutable version. A full 200 response during resume is truncated/restarted, never appended.
- Connectivity recovery recognizes both normalized metadata network/timeout errors and Dio byte-transfer network/timeout errors. Reconnection does not retry manual cancellation, denied access, certificate failures, invalid package data or storage errors.
- Android/iOS capacity adapters check free space before transfer and completion, retaining a 4 MiB margin. Unknown capacity and disk errors cannot complete a package. The file is renamed only after the expected byte count is present. Previous versions remain separate.
- Camper Trip details and Trip sync show the panel. Porter schedule items with a Trip ID link to the same downloader. Existing mock-only Porter schedule rows without Trip IDs cannot supply a real package context.
- Completed bytes remain `downloaded` and explicitly unverified. No ZIP decoder, checksum activation, basemap download, offline rendering, medical-data export, or ongoing Trip version switch is introduced. CTMS-054 must verify the archive before use.

## Related generator correction

The focused regression run reproduced two pre-existing CTMS-052 failures: expired optional hazard feeds were serialized as `NO_ACTIVE_ALERT`. They now remain `UNKNOWN`. Current checked EMPTY/AVAILABLE feeds retain the existing no-alert behavior. Future/invalid checked times, malformed/expired validity and missing provenance cannot become a no-alert claim. Generator policy `ctms052-v2` separates future regeneration identities from earlier v1 artifacts; stored READY bytes are not rewritten and no regeneration is triggered by this change.

## Verification evidence

| Check | Observed result | Boundary |
| --- | --- | --- |
| API TypeScript `tsc --noEmit` | PASS | Production TypeScript compilation |
| Focused Jest download/generator/auth suites | **87/87 PASS, 7 suites** | 33 new download policy/range cases plus relevant generator/auth regression |
| Dart analysis of feature, tests and touched integration files | **No issues found** | Dart static checks; not native compilation |
| Mobile transfer test bodies on Dart VM | **18/18 PASS** | Existing test_api/matcher harness, fake API/capacity, real filesystem; not Flutter widget/device execution |
| HTTP suite through Node/Nest request listener in process | **38/38 PASS** | Production routing, JWT/role guards and response serialization; mocked account/participation/artifact sources, no TCP or real DB |
| PostgreSQL authorization integration | User local rerun: **19/19 PASS** on a fresh, separate PostgreSQL test container at port 55432 | Production access repository SQL against real PostgreSQL and isolated fixture tables. Covers membership, assignment, Trip statuses and revocation. Does not establish compatibility with the complete migrated application schema. |
| Socket HTTP E2E | User local rerun: **38/38 PASS**, 1 suite, 3.025 s | Production JWT/role guards and real loopback HTTP; account/participation/artifact sources remain mocked. Raw ZIP assertions use `arraybuffer` and include non-UTF-8 fixture bytes. No real database or proxy coverage is claimed. |
| Flutter feature tests | User local run: **29/29 PASS** | Transfer, retry classification and widget tests; native device capacity channels still require execution |
| Android/iOS native smoke tests | Not executed | Native capacity channels and device lifecycle behavior still require execution |

The temporary Dart/HTTP adapters used for this sandbox checkpoint are under ignored runtime/test-results directories. The checked-in tests remain normal Flutter/Jest tests. No dependency installation, schema migration, release build, deployment, commit, or Jira transition was performed.

The original PostgreSQL server at port 5432 returned `could not open critical system index 2662` during the first local integration run. The passing rerun used a fresh `ctms53-postgres-test` container with image `postgis/postgis:16-3.4-alpine` and database `ctms_test`. That rerun establishes the isolated authorization behavior; diagnosis and recovery of the original server remain separate, unresolved work.

## Commands for normal local verification

From `services/api`:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/jest/bin/jest.js --runInBand --cacheDirectory=./test-results/jest-cache --testPathPattern='offline-package-download|offline-packages|jwt-auth.guard|roles.guard'
node node_modules/jest/bin/jest.js --runInBand --config ./test/jest-offline-package-download.json
node node_modules/jest/bin/jest.js --runInBand --config ./test/jest-integration.json --testPathPattern=offline-package-access
```

The database command is limited to a configured `*_test` database and creates a unique schema; it does not use the application database. The standalone HTTP configuration requires no database setup.

From `apps/mobile`:

```powershell
flutter analyze
flutter test --no-pub test/features/offline_packages
```

Native acceptance should exercise an authorized real READY package on Android/iOS: pause, remove connectivity, restore connectivity, terminate/relaunch the app, exhaust storage, revoke participation, and download v2 while v1 remains on disk. Production READY generation still depends on the authoritative upstream safety/guidance contracts; fictional fixtures do not resolve those dependencies.

See [the specification](../../file/spec/ctms-53-download-offline-package-before-departure.md) for endpoint, local-data, state and acceptance mappings.

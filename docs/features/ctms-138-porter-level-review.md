# CTMS-138 — Porter level criteria and manual review

The approved request workflow and exact API/state rules are documented in
`file/spec/ctms-138-porter-level-requests.md`.

Approved scope: retain `learning / proficient / expert`; Admin configures names, experience years,
times led, skills, certificates and responsibilities. Numeric fields may be explicitly unset.
There are no seeded policy defaults and no automatic promotion/demotion. Policies are global per
level; each decision applies to one Porter's qualification on one Route.

## Manual UI test

### Shared demo data (main.seed.ts only)

The master seed includes CTMS-138 demo requests for the existing account
`porter.learning@ctms.local` / `Porter@123`. Admin uses `admin@ctms.local` / `Admin@123`.
No additional seed file is needed. After migrations, run the master seed without
`--fresh` against a development database:

```powershell
cd services/api
node -r ts-node/register src/seeds/main.seed.ts
```

The first three canonical Routes contain a pending request, a needs-info request,
and a cancelled request. The fourth Route remains free to test request creation.
Admin can approve/reject the pending request; Porter can supplement the needs-info
request. Upload test evidence through the UI; no fabricated file references are seeded.
The learning Porter receives an approved demo certificate dossier only if no dossier
already exists. Existing verification decisions are preserved.

Missing level policies receive clearly marked demo descriptions with no numeric
thresholds or required skills/certificates. Existing policies, ranks, requests and
history are preserved; rerunning the demo does not reset completed requests.
The main `porter@ctms.local` account retains its existing ranks. This is development
data, not approved business criteria. Other sections of the master seed still refresh
their own scenarios; use a development database. The package `seed` scripts include
`--fresh` and wipe data, so do not use them to retain existing local records.

1. Run API and web using the existing environment. API startup applies migrations, including
   `1793100000000-CreatePorterLevelReviews` and `1793100000001-CreatePorterLevelRequests`.
   No seed execution is required for an existing database.
2. Log in as Admin and open `/admin/porter-levels` (menu **Cấp độ Porter**).
3. Select a level, configure its name and responsibilities, optionally enter criteria, then save.
   Confirm existing qualifications stay unchanged.
4. Select **Xét cấp** for a Porter/Route. Choose the target level, compare the dossier, enter a
   reason and apply the level manually. Open requests must be processed first. Certificate verification must already be approved to approve
   a level. It is managed separately at `/admin/porter-verifications`.
5. Read **Lịch sử xét cấp**, edit the policy, and verify the recorded criteria/version remain unchanged.
6. Log in as Porter and open `/porter/profile`. Read criteria/history and edit declared skills.
   Profile changes do not alter an approved level. Add an unreviewed Route claim in the existing
   qualification panel if no qualification exists yet.

Skills, textual certificates and times led in this comparison are declared evidence. The UI places
facts beside criteria without grading. Admin reviews supporting evidence and records the reason. An
approved certificate dossier is a separate mandatory gate. Admin cannot review their own level.
Approved rank edits use the Admin review workflow; the legacy direct verify endpoint returns 409.
Concurrent or stale decisions return 409 instead of overwriting newer evidence or adding duplicate
history for the same reviewed version. Reload and compare before submitting again.

History stores actor, event time, reason, previous/target level, and full policy, dossier and
comparison snapshots. The UI shows the latest 100 decisions for the qualification or own Porter.
Existing verified qualifications are preserved; no retrospective review history is invented.

## Validation

- `services/api/test/porter-levels.integration-spec.ts`: real PostgreSQL + HTTP in an isolated `_test` DB.
- `services/api/test/porter-level-requests.integration-spec.ts`: request lifecycle, concurrency, retained files, rollback and outbox.
- `services/api/src/modules/porter-levels/porter-level-comparison.spec.ts`: comparison and fingerprint.
- `apps/web/src/features/porter-levels/components/PorterLevels.test.tsx`: Admin review and Porter skills.
- `apps/web/src/features/porter-levels/components/LevelRequests.test.tsx`: request creation, editing gates and Admin actions.

If additional development seed data is needed, add it only to `services/api/src/seeds/main.seed.ts`.

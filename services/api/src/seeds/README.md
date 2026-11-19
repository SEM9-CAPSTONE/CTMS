# Database seeds

`main.seed.ts` contains the application seed data, including financial adjustments,
legacy financial host consolidation, revenue analytics and safety hotspots. The full
seed keeps their existing execution order: accounts and trips before financial
records; performance reports before revenue analytics; safety hotspots after completed
trips and participants exist. Fixed record IDs and existing financial workflows are
preserved by the consolidation.

Run commands from the repository root:

| Command | Behavior |
| --- | --- |
| `pnpm seed` / `pnpm seed:all` / `pnpm seed:fresh` | Rebuild the development dataset; these existing commands pass `--fresh` and clear the database. |
| `pnpm --filter @ctms/api exec ts-node src/seeds/main.seed.ts` | Run the full seed without the explicit database wipe. Individual scenarios may refresh their own data. |
| `pnpm --filter @ctms/api seed:financial-adjustments` | Financial adjustments using the existing admin, host and camper accounts. |
| `pnpm --filter @ctms/api seed:revenue-analytics` | Revenue history and trip area snapshots. |
| `pnpm --filter @ctms/api seed:safety-hotspots` | Safety hotspots using existing trips and participants. |
| `pnpm --filter @ctms/api seed:performance-reports` | Booking and trip performance reports. |
| `pnpm --filter @ctms/api seed:bank-accounts` | Host and camper bank accounts. |
| `pnpm --filter @ctms/api seed:group-bookings` | Group bookings and equipment. |
| `pnpm --filter @ctms/api seed:da-nang` | Repair recognized seed names, descriptions and route coordinates around Đà Nẵng. Preserves existing IDs, relations, statuses, bookings, photos and money. |

All CLI seed commands use the master entry point, reject production and close the
database connection on success or failure. Partial commands require their prerequisite
accounts and trips to exist.

The safety hotspot section in `main.seed.ts` uses the existing Sơn Trà trips and
participants to run the real detector. New hotspots enter `UNDER_REVIEW`, where an
Admin can confirm or dismiss them directly. Open `/admin/safety-hotspots` and select
**Đang xem xét**. Confirmed fixtures use `HotspotReviewService`, including decision
history and audit entries. Existing `DETECTED` records remain actionable as legacy data.
Re-running the seed preserves existing Admin decisions, comments and corrective actions.

Use `seed:da-nang` to update an existing development database without rebuilding its
dataset. Legacy place names remain only as exact lookup metadata in the master
seed. The repair replaces known seed text while preserving appended notes, keeps
route and trip IDs in place, and never creates accounts or runs migrations.

`test/helpers/db-helper.ts` and `test/helpers/content-reports-e2e.ts` are E2E tools,
not application seeds. Test runners call them explicitly; the master seed never
runs their account creation or cleanup actions. Web E2E tests and the mobile OTP
verification script reference their new locations.

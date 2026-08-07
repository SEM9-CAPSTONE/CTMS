import { hash } from "bcrypt";
import { BCRYPT_COST_FACTOR } from "../modules/auth/auth.service";
import dataSource from "../shared/database/data-source";

/**
 * Creates one reusable, dev-only admin account for manual testing.
 *
 * NOT a migration on purpose: `typeorm.config.ts` sets `migrationsRun: true`,
 * which runs every migration automatically on every app boot in every
 * environment this DataSource config is used for — including a hypothetical
 * production deploy. A seed belongs in data, not schema, and must only run
 * when a developer explicitly invokes it (`pnpm --filter @ctms/api
 * seed:dev-admin`), never automatically.
 *
 * Idempotent: checks for an existing row (by email OR phone) before
 * inserting. If found, creates nothing and updates nothing — just skips.
 * The INSERT also carries `ON CONFLICT (email) DO NOTHING` as a defensive
 * fallback against a rare concurrent double-run, not as the primary
 * idempotency mechanism.
 *
 * Password hashing reuses AuthService's own BCRYPT_COST_FACTOR export — same
 * algorithm, same cost factor as POST /auth/register, never a separate or
 * hardcoded hash.
 */

const ADMIN_EMAIL = "admin@ctms.local";
const ADMIN_PHONE = "0900000000";
const ADMIN_PASSWORD = "Admin@123";

async function seedDevAdmin(): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:dev-admin] Refusing to run with NODE_ENV=production.");
	}

	await dataSource.initialize();

	try {
		const existing: Array<{ id: string; email: string | null }> = await dataSource.query(
			'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[ADMIN_EMAIL, ADMIN_PHONE]
		);

		if (existing.length > 0) {
			console.log(
				`[seed:dev-admin] Already exists (id=${existing[0].id}, email=${existing[0].email}) — skipping. Nothing created, nothing updated.`
			);
			return;
		}

		// Same hashing flow as Register (AuthService.register()): bcrypt at
		// BCRYPT_COST_FACTOR. Never a plaintext password, never a hardcoded hash.
		const passwordHash = await hash(ADMIN_PASSWORD, BCRYPT_COST_FACTOR);

		const inserted: Array<{ id: string }> = await dataSource.query(
			`INSERT INTO "users" (email, phone, password_hash, role, status)
			 VALUES ($1, $2, $3, 'admin', 'active')
			 ON CONFLICT (email) DO NOTHING
			 RETURNING id`,
			[ADMIN_EMAIL, ADMIN_PHONE, passwordHash]
		);

		if (inserted.length === 0) {
			console.log(
				"[seed:dev-admin] Insert skipped by ON CONFLICT (created by a concurrent run) — nothing created."
			);
			return;
		}

		console.log(
			`[seed:dev-admin] Created dev admin account (id=${inserted[0].id}, email=${ADMIN_EMAIL}).`
		);
	} finally {
		await dataSource.destroy();
	}
}

seedDevAdmin().catch((error) => {
	console.error("[seed:dev-admin] Failed:", error);
	process.exitCode = 1;
});

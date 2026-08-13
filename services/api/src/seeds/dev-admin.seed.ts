import { hash } from "bcrypt";
import { BCRYPT_COST_FACTOR } from "../modules/auth/auth.service";
import dataSource from "../shared/database/data-source";

/**
 * Creates reusable, dev-only Admin and Porter accounts for manual testing.
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

interface SeedAccount {
	label: string;
	email: string;
	phone: string;
	password: string;
	role: "admin" | "porter";
}

const SEED_ACCOUNTS: SeedAccount[] = [
	{
		label: "admin",
		email: "admin@ctms.local",
		phone: "0900000000",
		password: "Admin@123",
		role: "admin",
	},
	{
		label: "porter",
		email: "porter@ctms.local",
		phone: "0900000001",
		password: "Porter@123",
		role: "porter",
	},
];

async function seedDevAdmin(): Promise<void> {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[seed:dev-admin] Refusing to run with NODE_ENV=production.");
	}

	await dataSource.initialize();

	try {
		for (const account of SEED_ACCOUNTS) {
			await seedAccount(account);
		}
	} finally {
		await dataSource.destroy();
	}
}

async function seedAccount(account: SeedAccount): Promise<void> {
	const existing: Array<{ id: string; email: string | null }> = await dataSource.query(
		'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
		[account.email, account.phone]
	);

	if (existing.length > 0) {
		await grantRole(existing[0].id, account.role);
		console.log(
			`[seed:dev-admin] ${account.label} already exists (id=${existing[0].id}, email=${existing[0].email}) — ensured role=${account.role}.`
		);
		return;
	}

	// Same hashing flow as Register (AuthService.register()): bcrypt at
	// BCRYPT_COST_FACTOR. Never a plaintext password, never a hardcoded hash.
	const passwordHash = await hash(account.password, BCRYPT_COST_FACTOR);

	const inserted: Array<{ id: string }> = await dataSource.query(
		`INSERT INTO "users" (email, phone, password_hash, role, status)
			 VALUES ($1, $2, $3, $4, 'active')
			 ON CONFLICT (email) DO NOTHING
			 RETURNING id`,
		[account.email, account.phone, passwordHash, account.role]
	);

	if (inserted.length === 0) {
		const concurrentExisting: Array<{ id: string; email: string | null }> = await dataSource.query(
			'SELECT "id", "email" FROM "users" WHERE "email" = $1 OR "phone" = $2',
			[account.email, account.phone]
		);
		if (concurrentExisting.length > 0) {
			await grantRole(concurrentExisting[0].id, account.role);
		}
		console.log(
			`[seed:dev-admin] ${account.label} insert skipped by ON CONFLICT — ensured role if row now exists.`
		);
		return;
	}

	await grantRole(inserted[0].id, account.role);
	console.log(
		`[seed:dev-admin] Created dev ${account.label} account (id=${inserted[0].id}, email=${account.email}).`
	);
}

async function grantRole(userId: string, role: SeedAccount["role"]): Promise<void> {
	await dataSource.query(
		`INSERT INTO "user_roles" ("user_id", "role")
		 VALUES ($1, $2)
		 ON CONFLICT ("user_id", "role") DO NOTHING`,
		[userId, role]
	);
}

seedDevAdmin().catch((error) => {
	console.error("[seed:dev-admin] Failed:", error);
	process.exitCode = 1;
});

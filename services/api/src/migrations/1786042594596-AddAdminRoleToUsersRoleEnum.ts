import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds 'admin' as a valid users.role value. Scoped narrowly to the enum
 * itself — CTMS-06 ("Manage Role-Based Access for Camper, Host, Porter, and
 * Admin", Status: To Do at the time of this migration) still owns the full
 * RBAC feature; this migration only unblocks a schema-level prerequisite
 * (a dev-only seed admin account needs somewhere valid to store role='admin').
 *
 * RegisterDto is deliberately NOT relaxed to accept 'admin' — see its own
 * comment. Adding this enum value alone would otherwise let the public
 * POST /auth/register endpoint start accepting role=admin from anyone,
 * since RegisterDto used to validate against the whole UserRole enum.
 */
export class AddAdminRoleToUsersRoleEnum1786042594596 implements MigrationInterface {
	name = "AddAdminRoleToUsersRoleEnum1786042594596";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE 'admin'`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Postgres has no DROP VALUE for enums -- rebuild the type without
		// 'admin'. Fails on purpose if any row still has role='admin' at
		// revert time (the USING cast has nothing valid to map it to) --
		// that row must be reassigned or removed before this can revert.
		await queryRunner.query(`ALTER TYPE "users_role_enum" RENAME TO "users_role_enum_old"`);
		await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('camper', 'host', 'porter')`);
		await queryRunner.query(
			`ALTER TABLE "users" ALTER COLUMN "role" TYPE "users_role_enum" USING "role"::text::"users_role_enum"`
		);
		await queryRunner.query(`DROP TYPE "users_role_enum_old"`);
	}
}

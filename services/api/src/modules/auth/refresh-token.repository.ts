import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { RefreshToken } from "./entities/refresh-token.entity";

/**
 * Same factory-provider pattern as UsersRepository / VerificationOtpRepository
 * (the project's only established repository convention — confirmed by
 * `grep -rn "InjectRepository" src` returning zero matches anywhere in the
 * codebase). `save`/`findOneBy` inherited from Repository<T> cover lookup
 * needs; the 2 methods below are the only custom queries CTMS-03/CTMS-04
 * need.
 */
@Injectable()
export class RefreshTokenRepository extends Repository<RefreshToken> {
	async revokeActiveTokensForUser(userId: string, revokedAt: Date): Promise<void> {
		await this.createQueryBuilder()
			.update()
			.set({ revokedAt })
			.where("user_id = :userId", { userId })
			.andWhere("revoked_at IS NULL")
			.execute();
	}

	/**
	 * CTMS-04-T01, DG-03: atomically marks exactly 1 token revoked, but only
	 * if it is still active (not already revoked, not expired). This is the
	 * actual reuse/concurrent-refresh guard — the UNIQUE index on
	 * `token_hash` only prevents two *new* tokens from colliding; it says
	 * nothing about two requests racing to rotate the *same existing* token.
	 * A "read revokedAt, then write" done as two separate statements has a
	 * race window; a single conditional UPDATE does not — Postgres locks the
	 * row for the first statement to reach it, so the second statement's
	 * `revoked_at IS NULL` re-check (evaluated after the first commits) sees
	 * the already-revoked row and affects 0 rows. No Redis/distributed lock
	 * needed for this.
	 *
	 * Returns the number of rows affected (0 or 1). The caller (not a
	 * separate lookup) uses this to decide whether the token was still
	 * eligible to be rotated — 0 means someone else (a concurrent refresh,
	 * or a revoke via another flow such as resetPassword()) already
	 * invalidated it first.
	 */
	async revokeIfActive(id: string, revokedAt: Date): Promise<number> {
		const result = await this.createQueryBuilder()
			.update()
			.set({ revokedAt })
			.where("id = :id", { id })
			.andWhere("revoked_at IS NULL")
			.andWhere("expires_at > :now", { now: revokedAt })
			.execute();
		return result.affected ?? 0;
	}
}

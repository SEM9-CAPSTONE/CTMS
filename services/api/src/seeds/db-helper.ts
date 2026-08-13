import "dotenv/config";
import { randomInt } from "node:crypto";
import * as bcrypt from "bcrypt";
import dataSource from "../shared/database/data-source";

async function main() {
	const action = process.argv[2];
	const arg = process.argv[3];

	if (!dataSource.isInitialized) {
		await dataSource.initialize();
	}

	try {
		if (action === "get-user") {
			const rows = await dataSource.query(
				'SELECT "id", "email", "phone", "status", "role" FROM "users" WHERE "email" = $1',
				[arg]
			);
			if (rows.length === 0) {
				console.log(JSON.stringify({ user: null, hasOtp: false }));
				return;
			}
			const user = rows[0];
			const otpRows = await dataSource.query(
				'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
				[user.id]
			);
			console.log(JSON.stringify({ user, hasOtp: otpRows.length > 0 }));
		} else if (action === "get-otp") {
			const rows = await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [arg]);
			if (rows.length === 0) {
				throw new Error(`User not found: ${arg}`);
			}
			const userId = rows[0].id;

			const ttlMinutes = 10;
			const windowMinutes = 1440;
			const maxAttempts = 5;

			const code = randomInt(100000, 1000000).toString();
			const codeHash = await bcrypt.hash(code, 10);
			const now = new Date();
			const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

			const existing = await dataSource.query(
				'SELECT * FROM "verification_otps" WHERE "user_id" = $1',
				[userId]
			);

			let sendCount = 1;
			let windowStartedAt = now;

			if (existing.length > 0) {
				const ext = existing[0];
				const windowElapsed =
					now.getTime() - new Date(ext.window_started_at).getTime() > windowMinutes * 60_000;
				if (!windowElapsed) {
					if (ext.send_count >= maxAttempts) {
						throw new Error("OTP resend limit reached");
					}
					sendCount = ext.send_count + 1;
					windowStartedAt = new Date(ext.window_started_at);
				}
			}

			await dataSource.query(
				`INSERT INTO "verification_otps" (user_id, code_hash, expires_at, send_count, window_started_at)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (user_id) DO UPDATE 
				 SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, 
				     send_count = EXCLUDED.send_count, window_started_at = EXCLUDED.window_started_at`,
				[userId, codeHash, expiresAt, sendCount, windowStartedAt]
			);

			console.log(JSON.stringify({ otp: code }));
		} else if (action === "get-logs") {
			const logs = await dataSource.query(
				`SELECT "actor_id" AS "actorId", "action", "target_type" AS "targetType", 
				        "target_id" AS "targetId", "before", "after", "reason", "created_at" AS "createdAt"
				 FROM "audit_logs" 
				 WHERE "actor_id" = $1 OR "target_id" = $1
				 ORDER BY "created_at" ASC`,
				[arg]
			);
			console.log(JSON.stringify({ logs }));
		} else if (action === "get-seed-accounts") {
			const rows = await dataSource.query(
				`SELECT u.email, u.phone, u.status, u.role AS "primaryRole",
				        array_remove(array_agg(ur.role ORDER BY ur.role), NULL) AS roles
				 FROM "users" u
				 LEFT JOIN "user_roles" ur ON ur.user_id = u.id
				 WHERE u.email IN ('admin@ctms.local', 'host@ctms.local', 'porter@ctms.local')
				 GROUP BY u.id
				 ORDER BY u.email`
			);
			console.log(JSON.stringify({ accounts: rows }));
		} else if (action === "clean-user") {
			const rows = await dataSource.query('SELECT "id" FROM "users" WHERE "email" = $1', [arg]);
			if (rows.length > 0) {
				const userId = rows[0].id;
				await dataSource.transaction(async (manager) => {
					await manager.query('DELETE FROM "refresh_tokens" WHERE "user_id" = $1', [userId]);
					await manager.query('DELETE FROM "verification_otps" WHERE "user_id" = $1', [userId]);
					await manager.query(
						'DELETE FROM "audit_logs" WHERE "actor_id" = $1 OR "target_id" = $1',
						[userId]
					);
					await manager.query('DELETE FROM "users" WHERE "id" = $1', [userId]);
				});
				console.log(JSON.stringify({ success: true }));
			} else {
				console.log(JSON.stringify({ success: false, reason: "not_found" }));
			}
		} else {
			throw new Error(`Unknown action: ${action}`);
		}
	} finally {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
		}
	}
}

main().catch((error) => {
	console.error("DB Helper error:", error);
	process.exit(1);
});

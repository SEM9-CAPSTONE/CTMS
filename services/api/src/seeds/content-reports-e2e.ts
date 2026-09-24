import "dotenv/config";
import { randomInt, randomUUID } from "node:crypto";
import * as bcrypt from "bcrypt";
import dataSource from "../shared/database/data-source";

// Test-only fixtures. Every write is scoped to a unique E2E run, never seed accounts.
async function main(): Promise<void> {
	const [action, runId] = process.argv.slice(2);
	if (!/^[a-f0-9-]{36}$/.test(runId ?? "") || !["seed", "clean"].includes(action)) {
		throw new Error("Expected seed|clean and a UUID E2E run identifier");
	}
	const adminEmail = `e2e-content-reports-${runId}-admin@example.com`;
	const camperEmail = `e2e-content-reports-${runId}-camper@example.com`;
	await dataSource.initialize();
	try {
		await dataSource.transaction(async (manager) => {
			if (action === "clean") {
				const users: Array<{ id: string }> = await manager.query(
					"SELECT id FROM users WHERE email = ANY($1)",
					[[adminEmail, camperEmail]]
				);
				const ids = users.map((user) => user.id);
				await manager.query(
					"DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR target_id IN (SELECT id FROM content_reports WHERE reporter_id = ANY($1::uuid[]))",
					[ids]
				);
				await manager.query("DELETE FROM content_reports WHERE reporter_id = ANY($1::uuid[])", [
					ids,
				]);
				await manager.query("DELETE FROM refresh_tokens WHERE user_id = ANY($1::uuid[])", [ids]);
				await manager.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]);
				console.log(JSON.stringify({ cleaned: true }));
				return;
			}
			const password = "E2eReports!234";
			const hash = await bcrypt.hash(password, 10);
			const reporterId = randomUUID();
			const adminId = randomUUID();
			for (const [id, email, role] of [
				[adminId, adminEmail, "admin"],
				[reporterId, camperEmail, "camper"],
			]) {
				await manager.query(
					"INSERT INTO users (id, email, phone, password_hash, role, status, full_name) VALUES ($1, $2, $3, $4, $5, $6, $7)",
					[
						id,
						email,
						`09${randomInt(10000000, 99999999)}`,
						hash,
						role,
						"active",
						`E2E Content Reports ${role}`,
					]
				);
				await manager.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [id, role]);
			}
			const reportIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
			const targetId = randomUUID();
			for (const id of reportIds) {
				await manager.query(
					"INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4, $5)",
					[id, reporterId, "review", targetId, `E2E Content Reports ${runId}`]
				);
			}
			console.log(
				JSON.stringify({ adminEmail, camperEmail, password, reporterId, targetId, reportIds })
			);
		});
	} finally {
		await dataSource.destroy();
	}
}
main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});

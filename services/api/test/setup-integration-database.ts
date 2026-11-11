import { Client } from "pg";

const DEFAULT_TEST_DATABASE_URL = "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";

function quoteIdentifier(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

export default async function setupIntegrationDatabase(): Promise<void> {
	const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
	const url = new URL(databaseUrl);
	const databaseName = url.pathname.replace(/^\//, "");

	if (!databaseName.endsWith("_test")) {
		throw new Error(
			`Refusing to prepare integration database "${databaseName}". Use a database name ending with "_test".`
		);
	}

	const maintenanceUrl = new URL(databaseUrl);
	maintenanceUrl.pathname = "/postgres";

	const client = new Client({ connectionString: maintenanceUrl.toString() });
	await client.connect();
	try {
		const existing = await client.query<{ datname: string }>(
			"SELECT datname FROM pg_database WHERE datname = $1",
			[databaseName]
		);

		if (existing.rowCount === 0) {
			await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
		}
	} finally {
		await client.end();
	}
}

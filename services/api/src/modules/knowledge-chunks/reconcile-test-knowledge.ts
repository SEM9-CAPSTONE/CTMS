import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
import { KnowledgeChunksRepository } from "./knowledge-chunks.repository";

async function reconcile(): Promise<void> {
	const connectionString = process.env.TEST_DATABASE_URL;
	if (!connectionString) throw new Error("Set TEST_DATABASE_URL to a local test database.");
	const url = new URL(connectionString);
	const database = decodeURIComponent(url.pathname.slice(1));
	if (
		!["postgresql:", "postgres:"].includes(url.protocol) ||
		!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
		!/^\w+_test$/.test(database) ||
		url.search
	)
		throw new Error("Reconciliation requires a local PostgreSQL database ending in _test.");
	// Match the API's source policy when launched from services/api by the package script.
	for (const path of ["../../.env", ".env"]) {
		const file = resolve(path);
		if (existsSync(file)) process.loadEnvFile(file);
	}
	const db = new DataSource({ type: "postgres", url: connectionString });
	await db.initialize();
	try {
		const [identity]: Array<{ name: string }> = await db.query("SELECT current_database() AS name");
		if (identity?.name !== database) throw new Error("Unexpected test database identity.");
		const configuration = new KnowledgeChunksProvider(new ConfigService()).configuration();
		const result = await new KnowledgeChunksRepository(db).reconcile(configuration);
		console.info(JSON.stringify(result));
	} finally {
		await db.destroy();
	}
}

void reconcile().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Knowledge reconciliation failed.");
	process.exitCode = 1;
});

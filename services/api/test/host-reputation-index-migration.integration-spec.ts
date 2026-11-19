import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { DataSource } from "typeorm";
import { IndexVisibleHostReputation1797100000000 } from "../src/migrations/1797100000000-IndexVisibleHostReputation";
import { dataSourceOptions } from "../src/shared/database/typeorm.config";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-413 concurrent Host index on a clean database", () => {
	let db: DataSource;
	let maintenance: Client;
	let created = false;
	const databaseName = `ctms413_migration_${randomUUID().replaceAll("-", "")}_test`;
	const indexName = "idx_trip_reviews_host_reputation";
	const readIndex = () =>
		db.query(
			`SELECT i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
		 FROM pg_index i WHERE i.indexrelid=to_regclass($1)`,
			[indexName]
		);

	beforeAll(async () => {
		const url = new URL(process.env.TEST_DATABASE_URL ?? "");
		if (!url.pathname.endsWith("_test"))
			throw new Error("A dedicated test database URL is required.");
		maintenance = new Client({ connectionString: url.toString() });
		await maintenance.connect();
		await maintenance.query(`CREATE DATABASE "${databaseName}"`);
		created = true;
		url.pathname = `/${databaseName}`;
		db = new DataSource({ ...dataSourceOptions, url: url.toString(), migrationsRun: false });
		await db.initialize();
		await assertSafeTestDatabase(db);
		const [existing] = await db.query("SELECT to_regclass('trip_reviews') AS reviews");
		if (existing.reviews !== null) {
			throw new Error("This migration test requires a fresh, dedicated test database.");
		}
	}, 90000);

	afterAll(async () => {
		if (db?.isInitialized) await db.destroy();
		if (created) await maintenance.query(`DROP DATABASE "${databaseName}"`);
		await maintenance?.end();
	});

	it("applies all migrations from empty using the production transaction mode", async () => {
		expect(dataSourceOptions.migrationsTransactionMode).toBe("each");
		expect(new IndexVisibleHostReputation1797100000000().transaction).toBe(false);
		const executed = await db.runMigrations();
		expect(executed.at(-1)?.name).toBe("IndexVisibleHostReputation1797100000000");
		expect(await readIndex()).toEqual([
			expect.objectContaining({ valid: true, definition: expect.stringContaining("(host_id)") }),
		]);
	}, 90000);

	it("rolls down the index and reapplies it while preserving the review table", async () => {
		// TypeORM's revert path ignores the migration's transaction=false flag.
		await db.undoLastMigration({ transaction: "none" });
		expect(await readIndex()).toEqual([]);
		const [reviews] = await db.query("SELECT to_regclass('trip_reviews') AS reviews");
		expect(reviews.reviews).toBe("trip_reviews");
		const executed = await db.runMigrations();
		expect(executed.map(({ name }) => name)).toEqual(["IndexVisibleHostReputation1797100000000"]);
		expect((await readIndex())[0].valid).toBe(true);
	}, 30000);

	it("retries both a completed index build and an invalid interrupted build", async () => {
		const migration = new IndexVisibleHostReputation1797100000000();
		const runner = db.createQueryRunner();
		await runner.connect();
		try {
			await migration.up(runner);
			expect((await readIndex())[0].valid).toBe(true);
			await migration.down(runner);
			await runner.query("CREATE TABLE ctms413_index_retry (duplicate_value integer)");
			await runner.query("INSERT INTO ctms413_index_retry VALUES (1),(1)");
			await expect(
				runner.query(
					`CREATE UNIQUE INDEX CONCURRENTLY ${indexName} ON ctms413_index_retry (duplicate_value)`
				)
			).rejects.toMatchObject({ driverError: { code: "23505" } });
			expect((await readIndex())[0].valid).toBe(false);
			await migration.up(runner);
			expect(await readIndex()).toEqual([
				expect.objectContaining({
					valid: true,
					definition: expect.stringContaining("ON public.trip_reviews"),
				}),
			]);
		} finally {
			await runner.query("DROP TABLE IF EXISTS ctms413_index_retry");
			await runner.release();
		}
	}, 30000);
});

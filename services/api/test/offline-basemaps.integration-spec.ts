import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { DataSource } from "typeorm";
import { CreateOfflineBasemaps1794900000000 } from "../src/migrations/1794900000000-CreateOfflineBasemaps";
import { CreateOfflineBasemapJobs1795000000000 } from "../src/migrations/1795000000000-CreateOfflineBasemapJobs";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("durable basemap publication", () => {
	const schema = `basemap_${randomUUID().replace(/-/g, "")}`;
	let db: DataSource;
	beforeAll(async () => {
		const url = process.env.TEST_DATABASE_URL;
		db = new DataSource({
			type: "postgres",
			url,
			extra: { options: `-c search_path=${schema},public` },
		});
		await db.initialize();
		await assertSafeTestDatabase(db);
		await db.query(`CREATE SCHEMA ${schema}; CREATE TABLE trips(id uuid PRIMARY KEY,status text);
    CREATE TABLE offline_packages(id uuid PRIMARY KEY,trip_id uuid,artifact_key text,sha256 text,package_version integer);
    CREATE FUNCTION offline_package_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'immutable'; END $$;`);
		const q = db.createQueryRunner();
		await new CreateOfflineBasemaps1794900000000().up(q);
		await new CreateOfflineBasemapJobs1795000000000().up(q);
		await q.release();
	});
	afterAll(async () => {
		if (db?.isInitialized) {
			await db.query(`DROP SCHEMA ${schema} CASCADE`);
			await db.destroy();
		}
	});
	it("queues one job per committed core package", async () => {
		const id = randomUUID();
		await db.query("INSERT INTO offline_packages(id) VALUES($1)", [id]);
		const rows = await db.query(
			"SELECT status,attempts FROM offline_basemap_jobs WHERE package_id=$1",
			[id]
		);
		expect(rows).toEqual([{ status: "PENDING", attempts: 0 }]);
	});
	it("rolls back job when package publication rolls back", async () => {
		const id = randomUUID();
		await expect(
			db.transaction(async (manager) => {
				await manager.query("INSERT INTO offline_packages(id) VALUES($1)", [id]);
				throw new Error("publication failed");
			})
		).rejects.toThrow("publication failed");
		expect(await db.query("SELECT * FROM offline_basemap_jobs WHERE package_id=$1", [id])).toEqual(
			[]
		);
	});
	it("backfills existing packages after migration reapply", async () => {
		const q = db.createQueryRunner();
		const migration = new CreateOfflineBasemapJobs1795000000000();
		await migration.down(q);
		const id = randomUUID();
		await db.query("INSERT INTO offline_packages(id) VALUES($1)", [id]);
		await migration.up(q);
		expect(
			await db.query("SELECT status FROM offline_basemap_jobs WHERE package_id=$1", [id])
		).toEqual([{ status: "PENDING" }]);
		await q.release();
	});
	it("actual worker persists bounded retries for missing private core artifacts", async () => {
		const id = randomUUID();
		const trip = randomUUID();
		await db.query("INSERT INTO trips VALUES($1,'published')", [trip]);
		await db.query("INSERT INTO offline_packages VALUES($1,$2,'missing.zip',$3,1)", [
			id,
			trip,
			"0".repeat(64),
		]);
		const url = new URL(process.env.TEST_DATABASE_URL as string);
		url.searchParams.set("options", `-c search_path=${schema},public`);
		for (let attempt = 1; attempt <= 3; attempt++) {
			await expect(
				promisify(execFile)(
					process.execPath,
					[resolve(__dirname, "../scripts/generate-offline-basemap.cjs")],
					{
						cwd: resolve(__dirname, ".."),
						env: { ...process.env, DATABASE_URL: url.toString() },
					}
				)
			).rejects.toMatchObject({ code: 1 });
			const rows = await db.query(
				"SELECT status,attempts,last_error FROM offline_basemap_jobs WHERE package_id=$1",
				[id]
			);
			expect(rows).toEqual([
				{
					status: attempt === 3 ? "FAILED" : "PENDING",
					attempts: attempt,
					last_error: "BASEMAP_GENERATION_FAILED",
				},
			]);
			await db.query("UPDATE offline_basemap_jobs SET next_attempt_at=now() WHERE package_id=$1", [
				id,
			]);
		}
	});
});

import { randomUUID } from "node:crypto";
import { DataSource, type QueryRunner } from "typeorm";
import { NormalizeTripFormDraftValues1793000000002 } from "../src/migrations/1793000000002-NormalizeTripFormDraftValues";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Trip form draft schema repair", () => {
	const schema = `draft_repair_${randomUUID().replaceAll("-", "")}`;
	const migration = new NormalizeTripFormDraftValues1793000000002();
	let admin: DataSource;
	let db: DataSource;
	let runner: QueryRunner;

	beforeAll(async () => {
		admin = new DataSource({ type: "postgres", url: process.env.DATABASE_URL });
		await admin.initialize();
		await assertSafeTestDatabase(admin);
		await admin.query(`CREATE SCHEMA "${schema}"`);
		db = new DataSource({
			type: "postgres",
			url: process.env.DATABASE_URL,
			schema,
			extra: { options: `-c search_path=${schema},public` },
		});
		await db.initialize();
		runner = db.createQueryRunner();
		await runner.connect();
	}, 30_000);

	afterEach(async () => {
		await runner.query("DROP TABLE IF EXISTS trip_form_draft_images");
		await runner.query("DROP TABLE IF EXISTS trip_form_drafts");
	});
	afterAll(async () => {
		if (runner) await runner.release();
		if (db?.isInitialized) await db.destroy();
		if (admin?.isInitialized) {
			await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
			await admin.destroy();
		}
	});

	it("renames the legacy column without losing draft values or linked image bytes", async () => {
		await runner.query(
			'CREATE TABLE trip_form_drafts(id uuid PRIMARY KEY, "values" jsonb NOT NULL)'
		);
		await runner.query(
			"CREATE TABLE trip_form_draft_images(draft_id uuid REFERENCES trip_form_drafts(id), bytes bytea NOT NULL)"
		);
		const id = randomUUID();
		const values = { title: "Existing draft", description: "Keep this content" };
		const image = Buffer.from([137, 80, 78, 71]);
		await runner.query("INSERT INTO trip_form_drafts VALUES($1,$2)", [id, values]);
		await runner.query("INSERT INTO trip_form_draft_images VALUES($1,$2)", [id, image]);
		await migration.up(runner);
		await migration.up(runner);
		expect(
			await runner.query("SELECT form_values FROM trip_form_drafts WHERE id=$1", [id])
		).toEqual([{ form_values: values }]);
		expect(
			await runner.query("SELECT bytes FROM trip_form_draft_images WHERE draft_id=$1", [id])
		).toEqual([{ bytes: image }]);
	});

	it("leaves the current schema and data intact", async () => {
		await runner.query(
			"CREATE TABLE trip_form_drafts(id uuid PRIMARY KEY, form_values jsonb NOT NULL)"
		);
		const values = { title: "Current draft" };
		await runner.query("INSERT INTO trip_form_drafts VALUES($1,$2)", [randomUUID(), values]);
		await migration.up(runner);
		await migration.down();
		expect(await runner.query("SELECT form_values FROM trip_form_drafts")).toEqual([
			{ form_values: values },
		]);
	});

	it("repairs an empty table but refuses to replace unknown populated draft contents", async () => {
		await runner.query("CREATE TABLE trip_form_drafts(id uuid PRIMARY KEY, payload jsonb)");
		const values = { title: "Unknown legacy content" };
		await runner.query("INSERT INTO trip_form_drafts VALUES($1,$2)", [randomUUID(), values]);
		await expect(migration.up(runner)).rejects.toThrow("Inspect the existing draft columns");
		expect(await runner.query("SELECT payload FROM trip_form_drafts")).toEqual([
			{ payload: values },
		]);
		await runner.query("DELETE FROM trip_form_drafts");
		await migration.up(runner);
		expect(await runner.hasColumn("trip_form_drafts", "form_values")).toBe(true);
	});
});

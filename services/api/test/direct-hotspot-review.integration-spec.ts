import { DataSource, type QueryRunner } from "typeorm";
import { AllowDirectHotspotReview1796800000000 } from "../src/migrations/1796800000000-AllowDirectHotspotReview";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("Direct hotspot review database constraint", () => {
	let ds: DataSource;
	let runner: QueryRunner;
	const migration = new AllowDirectHotspotReview1796800000000();

	beforeAll(async () => {
		ds = new DataSource({ type: "postgres", url: process.env.DATABASE_URL });
		await ds.initialize();
		await assertSafeTestDatabase(ds);
	});

	beforeEach(async () => {
		runner = ds.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		// A temporary table shadows the real table for this connection only.
		await runner.query(`CREATE TEMP TABLE "hotspot_reviews" (
			"from_status" varchar(16) NOT NULL, "to_status" varchar(16) NOT NULL,
			CONSTRAINT "CHK_hotspot_reviews_transition" CHECK (
				("from_status" = 'DETECTED' AND "to_status" = 'UNDER_REVIEW')
				OR ("from_status" = 'UNDER_REVIEW' AND "to_status" IN ('CONFIRMED', 'DISMISSED'))
			)
		) ON COMMIT DROP`);
		await runner.query(`INSERT INTO "hotspot_reviews" VALUES
			('DETECTED','UNDER_REVIEW'),('UNDER_REVIEW','CONFIRMED'),('UNDER_REVIEW','DISMISSED')`);
		await migration.up(runner);
	});

	afterEach(async () => {
		await runner.rollbackTransaction();
		await runner.release();
	});

	afterAll(async () => {
		if (ds?.isInitialized) await ds.destroy();
	});

	it("accepts direct confirmation and dismissal without rewriting historical decisions", async () => {
		await runner.query(
			`INSERT INTO "hotspot_reviews" VALUES ('DETECTED','CONFIRMED'),('DETECTED','DISMISSED')`
		);
		const rows = await runner.query(`SELECT "from_status", "to_status" FROM "hotspot_reviews"`);
		expect(rows).toEqual([
			{ from_status: "DETECTED", to_status: "UNDER_REVIEW" },
			{ from_status: "UNDER_REVIEW", to_status: "CONFIRMED" },
			{ from_status: "UNDER_REVIEW", to_status: "DISMISSED" },
			{ from_status: "DETECTED", to_status: "CONFIRMED" },
			{ from_status: "DETECTED", to_status: "DISMISSED" },
		]);
	});

	it.each([
		["CONFIRMED", "DISMISSED"],
		["DISMISSED", "CONFIRMED"],
		["CONFIRMED", "DETECTED"],
		["DETECTED", "DETECTED"],
	])("rejects invalid history %s → %s", async (from, to) => {
		await expect(
			runner.query(`INSERT INTO "hotspot_reviews" VALUES ($1,$2)`, [from, to])
		).rejects.toMatchObject({
			driverError: { constraint: "CHK_hotspot_reviews_transition" },
		});
	});

	it("refuses a downgrade that would discard direct decisions", async () => {
		await runner.query(`INSERT INTO "hotspot_reviews" VALUES ('DETECTED','CONFIRMED')`);
		await expect(migration.down(runner)).rejects.toThrow("preserve review history");
		const [row] = await runner.query(`SELECT count(*)::int AS count FROM "hotspot_reviews"`);
		expect(row.count).toBe(4);
	});

	it("can downgrade before direct decisions exist, preserving old history", async () => {
		await migration.down(runner);
		const [row] = await runner.query(`SELECT count(*)::int AS count FROM "hotspot_reviews"`);
		expect(row.count).toBe(3);
		await expect(
			runner.query(`INSERT INTO "hotspot_reviews" VALUES ('DETECTED','CONFIRMED')`)
		).rejects.toMatchObject({
			driverError: { constraint: "CHK_hotspot_reviews_transition" },
		});
	});
});

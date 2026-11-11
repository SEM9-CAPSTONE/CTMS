import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Global, type INestApplication, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { unzipSync } from "fflate";
import { DataSource, type EntityManager } from "typeorm";
import { CreateOfflinePackages1794200000000 } from "../src/migrations/1794200000000-CreateOfflinePackages";
import { OfflinePackagesModule } from "../src/modules/offline-packages/offline-packages.module";
import { OfflinePackagesService } from "../src/modules/offline-packages/offline-packages.service";
import {
	OfflineSafetySources,
	type PackageCore,
	PackageJobStatus,
	type PackageSafetyInputs,
	type ReadyPackageMetadata,
} from "../src/modules/offline-packages/offline-packages.types";
import { PackageCoreReader } from "../src/modules/offline-packages/package-core.reader";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import { fictionalPackageSafetyWithHazards } from "./support/offline-package-fixture";

@Global()
@Module({})
class E2EDatabaseModule {}

// Only the upstream publication contract is fictional. Reads and locking use real PostgreSQL.
class FictionalE2ESources extends OfflineSafetySources {
	async read(
		manager: EntityManager,
		_core: PackageCore,
		lock: boolean
	): Promise<PackageSafetyInputs> {
		const rows: { inputs: PackageSafetyInputs }[] = await manager.query(
			`SELECT inputs FROM e2e_source_revision WHERE id=1${lock ? " FOR SHARE" : ""}`
		);
		return rows[0].inputs;
	}
}

describe("CTMS-052 module E2E: published Trip -> automatic worker -> stored verified ZIP", () => {
	const schema = `ctms52e2e_${randomUUID().replace(/-/g, "")}`;
	const testRoot = resolve(__dirname, "../test-results");
	const tripId = randomUUID();
	const routeId = randomUUID();
	let db: DataSource;
	let app: INestApplication | undefined;
	let root: string | undefined;
	const previousRoot = process.env.OFFLINE_PACKAGE_STORAGE_ROOT;
	const previousWorker = process.env.OFFLINE_PACKAGE_WORKER_ENABLED;

	beforeAll(async () => {
		const url = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:55451/ctms_test";
		if (!new URL(url).pathname.endsWith("_test")) throw new Error("Requires a *_test database");
		db = new DataSource({
			type: "postgres",
			url,
			extra: { options: `-c search_path=${schema},public`, connectionTimeoutMillis: 3000 },
		});
		await db.initialize();
		await assertSafeTestDatabase(db);
		await db.query(`CREATE EXTENSION IF NOT EXISTS postgis; CREATE SCHEMA ${schema}`);
		await db.query(`
		 CREATE TABLE trekking_routes(id uuid PRIMARY KEY,route_geom geography(LineString,4326));
		 CREATE TABLE trips(id uuid PRIMARY KEY,route_id uuid NOT NULL REFERENCES trekking_routes(id),status text NOT NULL,trip_type text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL);
		 CREATE TABLE checkpoints(id uuid PRIMARY KEY,route_id uuid NOT NULL REFERENCES trekking_routes(id),name text,type text,location geography(Point,4326),radius_m integer,expected_arrival_offset integer,instructions text,route_position double precision);
		 CREATE TABLE trip_waypoints(id uuid PRIMARY KEY,trip_id uuid NOT NULL REFERENCES trips(id),checkpoint_id uuid,type text,name text,location geography(Point,4326),day_number integer,sequence_order integer,planned_at timestamptz,duration_minutes integer);
		 CREATE TABLE e2e_source_revision(id integer PRIMARY KEY,inputs jsonb NOT NULL);
		`);
		const runner = db.createQueryRunner();
		try {
			await new CreateOfflinePackages1794200000000().up(runner);
		} finally {
			await runner.release();
		}
		await db.query(
			"INSERT INTO trekking_routes VALUES($1,ST_GeogFromText('SRID=4326;LINESTRING(108 16,108.01 16.01)'))",
			[routeId]
		);
		await db.query(
			"INSERT INTO trips VALUES($1,$2,'draft','day_trip','2026-12-01T01:00:00Z','2026-12-01T10:00:00Z')",
			[tripId, routeId]
		);
		await db.query(
			"INSERT INTO checkpoints VALUES($1,$2,'Checkpoint','rest',ST_GeogFromText('SRID=4326;POINT(108 16)'),30,10,'Fictional instructions',0.5)",
			[randomUUID(), routeId]
		);
		for (const [index, type] of ["start", "finish"].entries())
			await db.query(
				"INSERT INTO trip_waypoints VALUES($1,$2,NULL,$3,'Waypoint',ST_GeogFromText('SRID=4326;POINT(108 16)'),1,$4,$5,0)",
				[randomUUID(), tripId, type, index, index ? "2026-12-01T10:00:00Z" : "2026-12-01T01:00:00Z"]
			);
		const core = await new PackageCoreReader().read(db.manager, tripId);
		const safety = fictionalPackageSafetyWithHazards(core);
		await db.query("INSERT INTO e2e_source_revision VALUES(1,$1::jsonb)", [JSON.stringify(safety)]);
		await mkdir(testRoot, { recursive: true });
		root = await mkdtemp(join(testRoot, "ctms52-e2e-"));
		process.env.OFFLINE_PACKAGE_STORAGE_ROOT = root;
		process.env.OFFLINE_PACKAGE_WORKER_ENABLED = "true";
	});
	afterAll(async () => {
		await app?.close();
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
			await db.destroy();
		}
		if (root) {
			if (dirname(root) !== testRoot) throw new Error("Unexpected cleanup path");
			await rm(root, { recursive: true, force: true });
		}
		if (previousRoot === undefined)
			Reflect.deleteProperty(process.env, "OFFLINE_PACKAGE_STORAGE_ROOT");
		else process.env.OFFLINE_PACKAGE_STORAGE_ROOT = previousRoot;
		if (previousWorker === undefined)
			Reflect.deleteProperty(process.env, "OFFLINE_PACKAGE_WORKER_ENABLED");
		else process.env.OFFLINE_PACKAGE_WORKER_ENABLED = previousWorker;
	});

	it("automatically builds both hazard sources and complete guidance, then independently hashes persisted bytes", async () => {
		await db.query("UPDATE trips SET status='published' WHERE id=$1", [tripId]);
		const pending: { status: PackageJobStatus }[] = await db.query(
			"SELECT status FROM offline_package_jobs WHERE trip_id=$1",
			[tripId]
		);
		expect(pending.map((job) => job.status)).toEqual([PackageJobStatus.PENDING]);
		const module = await Test.createTestingModule({
			imports: [
				{
					module: E2EDatabaseModule,
					global: true,
					providers: [{ provide: DataSource, useValue: db }],
					exports: [DataSource],
				},
				ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
				OfflinePackagesModule,
			],
		})
			.overrideProvider(OfflineSafetySources)
			.useClass(FictionalE2ESources)
			.compile();
		app = module.createNestApplication();
		await app.init();
		const packages = module.get(OfflinePackagesService);
		const deadline = Date.now() + 15000;
		let metadata: ReadyPackageMetadata | null = null;
		while (Date.now() < deadline) {
			metadata = await packages.getReadyMetadata(tripId, 1);
			if (metadata) break;
			await delay(25);
		}
		expect(metadata).not.toBeNull();
		if (!metadata || !root) throw new Error("Worker did not publish a package");
		const objects: { artifact_key: string }[] = await db.query(
			"SELECT artifact_key FROM offline_packages WHERE trip_id=$1",
			[tripId]
		);
		expect(objects).toHaveLength(1);
		expect(objects[0].artifact_key).toMatch(/^[a-f0-9]{64}\.zip$/);
		const bytes = await readFile(join(root, objects[0].artifact_key));
		const actualSha256 = createHash("sha256").update(bytes).digest("hex");
		expect(actualSha256).toBe(metadata.sha256);
		expect(bytes.length).toBe(metadata.sizeBytes);
		const manifest = await packages.getManifest(tripId, 1);
		if (!manifest) throw new Error("Missing manifest");
		const entries = unzipSync(bytes);
		expect(Object.keys(entries).sort()).toEqual([
			"checkpoints.json",
			"guidance.json",
			"hazards.geojson",
			"manifest.json",
			"route.geojson",
			"waypoints.json",
		]);
		for (const file of manifest.files) {
			expect(createHash("sha256").update(entries[file.path]).digest("hex")).toBe(file.sha256);
		}
		const parsed = (name: string): unknown =>
			JSON.parse(Buffer.from(entries[name]).toString("utf8"));
		expect(parsed("route.geojson")).toMatchObject({
			geometry: { type: "LineString" },
			properties: { routeId },
		});
		expect(parsed("checkpoints.json")).toEqual([expect.objectContaining({ routeId })]);
		expect(parsed("waypoints.json")).toHaveLength(2);
		expect(parsed("hazards.geojson")).toMatchObject({
			features: [
				expect.objectContaining({
					properties: expect.objectContaining({ sourceType: "FIELD_VERIFIED" }),
				}),
				expect.objectContaining({
					properties: expect.objectContaining({ sourceType: "GOVERNMENT" }),
				}),
			],
		});
		expect(parsed("guidance.json")).toEqual([
			expect.objectContaining({ unitId: "fictional-unit", chunkIds: ["fictional-chunk"] }),
		]);
		const shared = Object.values(entries)
			.map((entry) => Buffer.from(entry).toString("utf8"))
			.join("\n");
		for (const secret of ["PRIVATE_REPORT_ID", "PRIVATE_HOST_ID", "PRIVATE_EVIDENCE_REFERENCE"])
			expect(shared).not.toContain(secret);
		const audit: { status: string }[] = await db.query(
			"SELECT status FROM offline_package_audit ORDER BY id"
		);
		expect(audit.map((row) => row.status)).toEqual([
			PackageJobStatus.GENERATING,
			PackageJobStatus.READY,
		]);
		await writeFile(
			join(testRoot, "ctms52-e2e-evidence.json"),
			JSON.stringify(
				{
					tripId,
					packageVersion: metadata.packageVersion,
					sizeBytes: bytes.length,
					sha256: actualSha256,
					files: manifest.files,
					states: [PackageJobStatus.PENDING, ...audit.map((row) => row.status)],
				},
				null,
				2
			)
		);
	});
});

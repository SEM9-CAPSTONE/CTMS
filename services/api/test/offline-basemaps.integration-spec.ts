import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { zipSync } from "fflate";
import { DataSource } from "typeorm";
import { CreateOfflineBasemaps1794900000000 } from "../src/migrations/1794900000000-CreateOfflineBasemaps";
import { CreateOfflineBasemapJobs1795000000000 } from "../src/migrations/1795000000000-CreateOfflineBasemapJobs";
import { OfflineBasemapService } from "../src/modules/offline-package-download/offline-basemap.service";
import type { OfflinePackageAccessRepository } from "../src/modules/offline-package-download/offline-package-access.repository";
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

	it("builds and downloads independent regions through the actual worker, renderer and publisher", async () => {
		const root = await mkdtemp(join(tmpdir(), "ctms-basemap-test-"));
		const coreRoot = join(root, "cores");
		const basemapRoot = join(root, "basemaps");
		await mkdir(coreRoot);
		const url = new URL(process.env.TEST_DATABASE_URL as string);
		url.searchParams.set("options", `-c search_path=${schema},public`);
		// Deterministic raw-OSM fixture server; no provider tiles or invented production approvals.
		const server = createServer(async (request, response) => {
			let body = "";
			for await (const chunk of request) body += chunk.toString();
			const query = new URLSearchParams(body).get("data") ?? "";
			const match = /way\(([^)]+)\)/.exec(query);
			if (!match) {
				response.writeHead(400).end();
				return;
			}
			const [south, west, north, east] = match[1].split(",").map(Number);
			const elements = Array.from({ length: 20 }, (_, i) => ({
				type: "way",
				id: i,
				nodes: [i * 2, i * 2 + 1],
				tags: { highway: i % 2 ? "primary" : "path", name: `Fixture road ${i}` },
				geometry: [
					{ lat: south, lon: west + ((east - west) * i) / 19 },
					{ lat: north, lon: east - ((east - west) * i) / 19 },
				],
			}));
			response.setHeader("Content-Type", "application/json");
			response.end(JSON.stringify({ elements }));
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("No fixture server port");
		const env = {
			...process.env,
			DATABASE_URL: url.toString(),
			OFFLINE_PACKAGE_STORAGE_ROOT: coreRoot,
			OFFLINE_BASEMAP_STORAGE_ROOT: basemapRoot,
			OFFLINE_BASEMAP_WORK_ROOT: join(root, "work"),
			OFFLINE_BASEMAP_OSM_URL: `http://127.0.0.1:${address.port}/interpreter`,
		};
		const previousRoot = process.env.OFFLINE_BASEMAP_STORAGE_ROOT;
		process.env.OFFLINE_BASEMAP_STORAGE_ROOT = basemapRoot;
		try {
			const heartbeat = join(root, "heartbeat");
			await writeFile(heartbeat, "worker");
			const healthEnv = { ...env, OFFLINE_BASEMAP_HEARTBEAT_FILE: heartbeat };
			await promisify(execFile)(
				process.execPath,
				[resolve(__dirname, "../scripts/offline-basemap-health.cjs")],
				{ env: healthEnv }
			);
			await utimes(heartbeat, new Date(0), new Date(0));
			await expect(
				promisify(execFile)(
					process.execPath,
					[resolve(__dirname, "../scripts/offline-basemap-health.cjs")],
					{ env: healthEnv }
				)
			).rejects.toMatchObject({ code: 1 });
			const access = {
				downloadableTripStatus: jest.fn().mockResolvedValue("published"),
			} as unknown as OfflinePackageAccessRepository;
			const service = new OfflineBasemapService(db, access);
			const hashes: string[] = [];
			for (const [lon, lat] of [
				[108.27, 16.1],
				[108.44, 11.94],
			]) {
				const trip = randomUUID();
				const id = randomUUID();
				// A checkpoint deliberately outside the route-only bbox must extend the raster.
				const checkpoint = [lon + 0.03, lat + 0.01];
				const archive = Buffer.from(
					zipSync({
						"route.geojson": Buffer.from(
							JSON.stringify({
								geometry: {
									type: "LineString",
									coordinates: [
										[lon, lat],
										[lon + 0.005, lat + 0.005],
									],
								},
							})
						),
						"checkpoints.json": Buffer.from(
							JSON.stringify([
								{ location: { type: "Point", coordinates: [lon, lat] } },
								{ location: { type: "Point", coordinates: checkpoint } },
							])
						),
					})
				);
				await writeFile(join(coreRoot, `${id}.zip`), archive);
				await db.query("INSERT INTO trips VALUES($1,'published')", [trip]);
				await db.query("INSERT INTO offline_packages VALUES($1,$2,$3,$4,1)", [
					id,
					trip,
					`${id}.zip`,
					createHash("sha256").update(archive).digest("hex"),
				]);
				// Two competing processes may only claim/render this package once.
				await Promise.all(
					[1, 2].map(() =>
						promisify(execFile)(
							process.execPath,
							[resolve(__dirname, "../scripts/generate-offline-basemap.cjs")],
							{ cwd: resolve(__dirname, ".."), env, timeout: 120000 }
						)
					)
				);
				expect(
					await db.query("SELECT status,attempts FROM offline_basemap_jobs WHERE package_id=$1", [
						id,
					])
				).toEqual([{ status: "READY", attempts: 1 }]);
				const meta = await service.metadata("fixture-user", trip, 1);
				expect(meta.packageId).toBe(id);
				expect(meta.bounds[2]).toBeGreaterThan(checkpoint[0]);
				expect(meta.bounds[3]).toBeGreaterThan(checkpoint[1]);
				const download = await service.download("fixture-user", trip, 1);
				const chunks: Buffer[] = [];
				for await (const chunk of download.getStream()) chunks.push(Buffer.from(chunk));
				const bytes = Buffer.concat(chunks);
				expect(bytes.length).toBe(meta.sizeBytes);
				expect(createHash("sha256").update(bytes).digest("hex")).toBe(meta.sha256);
				expect(await readFile(join(basemapRoot, `${meta.sha256}.mbtiles`))).toEqual(bytes);
				hashes.push(meta.sha256);
				console.info(
					JSON.stringify({
						region: lat === 16.1 ? "Son Tra" : "Da Lat",
						bytes: meta.sizeBytes,
						sha256: meta.sha256,
						bounds: meta.bounds,
					})
				);
				// A manually supplied raster that misses a checkpoint must not be published.
				const outsideId = randomUUID();
				const outsideTrip = randomUUID();
				const outside = Buffer.from(
					zipSync({
						"route.geojson": Buffer.from(
							JSON.stringify({
								geometry: {
									type: "LineString",
									coordinates: [
										[lon, lat],
										[lon + 0.005, lat + 0.005],
									],
								},
							})
						),
						"checkpoints.json": Buffer.from(
							JSON.stringify([{ location: { type: "Point", coordinates: [lon + 0.1, lat] } }])
						),
					})
				);
				await writeFile(join(coreRoot, `${outsideId}.zip`), outside);
				await db.query("INSERT INTO trips VALUES($1,'published')", [outsideTrip]);
				await db.query("INSERT INTO offline_packages VALUES($1,$2,$3,$4,1)", [
					outsideId,
					outsideTrip,
					`${outsideId}.zip`,
					createHash("sha256").update(outside).digest("hex"),
				]);
				await expect(
					promisify(execFile)(
						process.execPath,
						[
							resolve(__dirname, "../scripts/publish-offline-basemap.cjs"),
							outsideTrip,
							"1",
							join(basemapRoot, `${meta.sha256}.mbtiles`),
						],
						{ env }
					)
				).rejects.toMatchObject({
					code: 1,
					stderr: expect.stringContaining("COVERAGE_INCOMPLETE"),
				});
				expect(
					await db.query("SELECT * FROM offline_basemaps WHERE package_id=$1", [outsideId])
				).toEqual([]);
				await db.query("UPDATE trips SET status='ongoing' WHERE id=$1", [outsideTrip]);
				const version2 = randomUUID();
				await db.query("INSERT INTO offline_packages VALUES($1,$2,$3,$4,2)", [
					version2,
					trip,
					`${id}.zip`,
					createHash("sha256").update(archive).digest("hex"),
				]);
				await expect(service.metadata("fixture-user", trip, 2)).rejects.toMatchObject({
					response: { code: "BASEMAP_NOT_READY" },
				});
				// Leave v2 pending but outside worker eligibility for the next region's run.
				await db.query("UPDATE trips SET status='ongoing' WHERE id=$1", [trip]);
			}
			expect(new Set(hashes).size).toBe(2);
		} finally {
			if (previousRoot === undefined)
				Reflect.deleteProperty(process.env, "OFFLINE_BASEMAP_STORAGE_ROOT");
			else process.env.OFFLINE_BASEMAP_STORAGE_ROOT = previousRoot;
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
			await rm(root, { recursive: true, force: true });
		}
	}, 180000);
});

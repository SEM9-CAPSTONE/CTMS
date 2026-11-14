import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DataSource, type EntityManager } from "typeorm";
import { CreateKnowledgeChunks1794100000000 } from "../src/migrations/1794100000000-CreateKnowledgeChunks";
import { CreateOfflinePackages1794200000000 } from "../src/migrations/1794200000000-CreateOfflinePackages";
import { KnowledgeChunksRepository } from "../src/modules/knowledge-chunks/knowledge-chunks.repository";
import { OfflinePackagesRepository } from "../src/modules/offline-packages/offline-packages.repository";
import { OfflinePackagesService } from "../src/modules/offline-packages/offline-packages.service";
import {
	OfflineSafetySources,
	type PackageCore,
	PackageFailure,
	type PackageJob,
	PackageJobStatus,
	PackageReason,
	type PackageSafetyInputs,
} from "../src/modules/offline-packages/offline-packages.types";
import { UnavailableOfflineSafetySources } from "../src/modules/offline-packages/offline-safety-sources";
import { PackageArtifactBuilder } from "../src/modules/offline-packages/package-artifact.builder";
import { LocalPackageArtifactStorage } from "../src/modules/offline-packages/package-artifact.storage";
import { PackageCoreReader } from "../src/modules/offline-packages/package-core.reader";
import {
	ApprovedGuidanceSelector,
	EligibleHazardResolver,
	PackageEligibilityValidator,
	TripSafetyContextResolver,
} from "../src/modules/offline-packages/package-policy";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import { fictionalPackageSafety } from "./support/offline-package-fixture";

// Real PostgreSQL/PostGIS and real migration, queue, transactions and filesystem.
// Minimal core tables isolate this suite. Fictional upstream approvals live only in this schema.
class FictionalDatabaseSources extends OfflineSafetySources {
	async read(
		manager: EntityManager,
		_core: PackageCore,
		lock: boolean
	): Promise<PackageSafetyInputs> {
		const rows: { inputs: PackageSafetyInputs }[] = await manager.query(
			`SELECT inputs FROM test_safety_revision WHERE id=1${lock ? " FOR SHARE" : ""}`
		);
		return rows[0].inputs;
	}
}

describe("CTMS-052 PostgreSQL publication, fencing and immutable artifacts", () => {
	const schema = `ctms52_${randomUUID().replace(/-/g, "")}`;
	const testRoot = resolve(__dirname, "../test-results");
	let db: DataSource;
	let root: string;
	let oldRoot: string | undefined;
	let repo: OfflinePackagesRepository;
	let service: OfflinePackagesService;
	let storage: LocalPackageArtifactStorage;
	let tripId: string;
	let routeId: string;
	const sources = new FictionalDatabaseSources();
	function generator(source: OfflineSafetySources = sources): OfflinePackagesService {
		return new OfflinePackagesService(
			db,
			repo,
			new PackageCoreReader(),
			source,
			new TripSafetyContextResolver(),
			new EligibleHazardResolver(),
			new ApprovedGuidanceSelector(),
			new PackageEligibilityValidator(),
			new PackageArtifactBuilder(),
			storage
		);
	}
	beforeAll(async () => {
		const url = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";
		if (!new URL(url).pathname.endsWith("_test")) throw new Error("Requires a test database");
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
		 CREATE TABLE test_safety_revision(id integer PRIMARY KEY,inputs jsonb NOT NULL);
		`);
		const runner = db.createQueryRunner();
		try {
			await new CreateOfflinePackages1794200000000().up(runner);
		} finally {
			await runner.release();
		}
		oldRoot = process.env.OFFLINE_PACKAGE_STORAGE_ROOT;
		await mkdir(testRoot, { recursive: true });
		root = await mkdtemp(join(testRoot, "ctms52-integration-"));
		process.env.OFFLINE_PACKAGE_STORAGE_ROOT = root;
		repo = new OfflinePackagesRepository(db);
		storage = new LocalPackageArtifactStorage();
		service = generator();
	}, 30000);
	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
			await db.destroy();
		}
		if (root) {
			if (dirname(root) !== testRoot) throw new Error("Unexpected cleanup path");
			await rm(root, { recursive: true, force: true });
		}
		if (oldRoot === undefined) Reflect.deleteProperty(process.env, "OFFLINE_PACKAGE_STORAGE_ROOT");
		else process.env.OFFLINE_PACKAGE_STORAGE_ROOT = oldRoot;
	});
	beforeEach(async () => {
		jest.restoreAllMocks();
		const current: { schema: string }[] = await db.query("SELECT current_schema() AS schema");
		if (current[0].schema !== schema)
			throw new Error("Refusing cleanup outside the private test schema");
		// Only the private schema is truncated; READY immutability forbids individual deletion.
		await db.query(
			"TRUNCATE offline_package_audit,offline_package_artifact_cleanup,offline_package_jobs,offline_packages,trip_waypoints,checkpoints,trips,trekking_routes,test_safety_revision CASCADE"
		);
		await db.query("INSERT INTO test_safety_revision VALUES(1,$1::jsonb)", [
			JSON.stringify(fictionalPackageSafety()),
		]);
		routeId = randomUUID();
		tripId = randomUUID();
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
	});
	async function publish(): Promise<void> {
		await db.query("UPDATE trips SET status='published' WHERE id=$1", [tripId]);
	}
	async function claim(): Promise<PackageJob> {
		const job = await repo.claim();
		if (!job) throw new Error("Expected durable request");
		return job;
	}
	async function updateSafety(
		change: (input: PackageSafetyInputs) => void,
		manager = db.manager
	): Promise<void> {
		const input = fictionalPackageSafety();
		change(input);
		await manager.query("UPDATE test_safety_revision SET inputs=$1::jsonb WHERE id=1", [
			JSON.stringify(input),
		]);
	}
	it("rolls back the initial request with publication and deduplicates repeated publish", async () => {
		await expect(
			db.transaction(async (manager) => {
				await manager.query("UPDATE trips SET status='published' WHERE id=$1", [tripId]);
				throw new Error("rollback");
			})
		).rejects.toThrow("rollback");
		expect(await repo.claim()).toBeNull();
		await publish();
		await publish();
		const jobs: { count: string }[] = await db.query("SELECT count(*) FROM offline_package_jobs");
		expect(jobs[0].count).toBe("1");
	});
	it("backfills previously published Trips and supports migration rollback/reapply", async () => {
		const runner = db.createQueryRunner();
		try {
			const migration = new CreateOfflinePackages1794200000000();
			await migration.down(runner);
			await publish();
			await migration.up(runner);
			expect((await claim()).trip_id).toBe(tripId);
		} finally {
			await runner.release();
		}
	});
	it("rejects draft requests and sparse published core", async () => {
		await expect(service.requestInitial(tripId)).rejects.toMatchObject({
			reasons: [PackageReason.TRIP_NOT_PUBLISHED],
		});
		await publish();
		await db.query("DELETE FROM trip_waypoints WHERE trip_id=$1", [tripId]);
		await expect(service.generate(await claim())).rejects.toMatchObject({
			reasons: expect.arrayContaining([PackageReason.CORE_INCOMPLETE]),
		});
		expect(await service.getReadyMetadata(tripId)).toBeNull();
	});
	it("creates a verified artifact, metadata and audit atomically", async () => {
		await publish();
		const job = await claim();
		await service.generate(job);
		const metadata = await service.getReadyMetadata(tripId);
		expect(metadata?.packageVersion).toBe(1);
		expect(await service.readArtifact(tripId, 1)).toBeInstanceOf(Buffer);
		expect((await service.getJobStatus(tripId, job.id))?.status).toBe(PackageJobStatus.READY);
		const audit: { status: string }[] = await db.query(
			"SELECT status FROM offline_package_audit WHERE job_id=$1 ORDER BY id",
			[job.id]
		);
		expect(audit.map((row) => row.status)).toEqual(["GENERATING", "READY"]);
	});
	it("keeps production BLOCKED while authoritative upstream contracts are absent", async () => {
		await publish();
		const job = await claim();
		try {
			await generator(new UnavailableOfflineSafetySources()).generate(job);
			throw new Error("Expected blocker");
		} catch (error) {
			expect(error).toBeInstanceOf(PackageFailure);
			await repo.fail(job, error as PackageFailure);
		}
		expect((await repo.status(tripId, job.id))?.status).toBe(PackageJobStatus.BLOCKED);
		expect(await repo.ready(tripId)).toBeNull();
		expect(await repo.claim()).toBeNull();
	});
	it("claims once concurrently and reuses the same package across impact identities", async () => {
		await publish();
		const claims = await Promise.all([repo.claim(), repo.claim()]);
		expect(claims.filter(Boolean)).toHaveLength(1);
		const initial = claims.find((job) => job !== null);
		if (!initial) throw new Error();
		await service.generate(initial);
		await Promise.all([
			service.requestImpact(tripId, "impact-a"),
			service.requestImpact(tripId, "impact-b"),
		]);
		await Promise.all([
			claim().then((job) => service.generate(job)),
			claim().then((job) => service.generate(job)),
		]);
		const packages: { count: string }[] = await db.query("SELECT count(*) FROM offline_packages");
		expect(packages[0].count).toBe("1");
	});
	it("preserves immutable v1 when approved inputs produce v2", async () => {
		await publish();
		await service.generate(await claim());
		const original = await service.readArtifact(tripId, 1);
		await updateSafety((input) => {
			input.revision = "fictional-revision-2";
			input.guidance[0].approval.version = "2";
		});
		const impact = await service.requestImpact(tripId, "approved-guidance-2");
		expect((await service.requestImpact(tripId, "approved-guidance-2")).id).toBe(impact.id);
		await service.generate(await claim());
		expect((await service.getReadyMetadata(tripId))?.packageVersion).toBe(2);
		expect((await service.readArtifact(tripId, 1))?.equals(original as Buffer)).toBe(true);
		await expect(
			db.query("UPDATE offline_packages SET size_bytes=1 WHERE trip_id=$1", [tripId])
		).rejects.toThrow("immutable");
		await expect(
			db.query("DELETE FROM offline_packages WHERE trip_id=$1", [tripId])
		).rejects.toThrow("immutable");
	});
	it("defers chunk cleanup during package revalidation and preserves the published ZIP after cleanup", async () => {
		// Use the real chunk schema and cleanup against the same private DB as the package worker.
		await db.query(`
			CREATE TABLE survival_documents(id uuid PRIMARY KEY, current_published_version_id uuid);
			CREATE TABLE survival_document_versions(
				id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES survival_documents(id),
				version_number integer NOT NULL, revision integer DEFAULT 1, status text NOT NULL,
				metadata jsonb NOT NULL, rights jsonb NOT NULL,
				file_ref text NOT NULL, original_filename text DEFAULT 'fixture.pdf',
				checksum text NOT NULL, size integer DEFAULT 100, content_type text DEFAULT 'application/pdf',
				original_version_id uuid, created_by text DEFAULT 'fixture-admin', created_at timestamptz DEFAULT now(),
				reviewed_by text, reviewed_at timestamptz, published_by text DEFAULT 'fixture-admin',
				published_at timestamptz DEFAULT now(), reason text, UNIQUE(document_id,id)
			);
			CREATE TABLE survival_document_outbox(id uuid PRIMARY KEY);
		`);
		const runner = db.createQueryRunner();
		try {
			await new CreateKnowledgeChunks1794100000000().up(runner);
		} finally {
			await runner.release();
		}
		const documentId = randomUUID();
		await db.query("INSERT INTO survival_documents(id) VALUES($1)", [documentId]);
		async function activate(versionNumber: number) {
			const versionId = randomUUID();
			const setId = randomUUID();
			const chunkId = randomUUID();
			const input = fictionalPackageSafety();
			const unit = input.guidance[0];
			const source = { ...unit.source, id: versionId, documentId, versionNumber };
			await db.transaction(async (manager) => {
				await manager.query("SELECT id FROM survival_documents WHERE id=$1 FOR UPDATE", [
					documentId,
				]);
				await manager.query(
					"UPDATE survival_document_versions SET status='SUPERSEDED' WHERE document_id=$1",
					[documentId]
				);
				await manager.query(
					`
					INSERT INTO survival_document_versions(id,document_id,version_number,status,metadata,rights,file_ref,checksum)
					VALUES($1,$2,$3,'PUBLISHED',$4,$5,$6,$7)`,
					[
						versionId,
						documentId,
						versionNumber,
						source.metadata,
						source.rights,
						source.fileRef,
						source.checksum,
					]
				);
				await manager.query(
					`
					INSERT INTO knowledge_chunk_sets(
						id,document_id,document_version_id,source_version,checksum,locale,configuration,config_hash,status,chunk_count,completed_at
					) VALUES($1,$2,$3,$4,$5,$6,'{}','fixture','READY',1,now()-interval '8 days')`,
					[setId, documentId, versionId, versionNumber, source.checksum, source.metadata.locale]
				);
				await manager.query(
					`
					INSERT INTO knowledge_chunks(id,chunk_set_id,document_version_id,source_version,locale,chunk_index,content,embedding_text,metadata,embedding)
					VALUES($1,$2,$3,$4,$5,0,$6,$6,'{}',ARRAY[1.0])`,
					[chunkId, setId, versionId, versionNumber, source.metadata.locale, unit.content]
				);
				await manager.query(
					"UPDATE survival_documents SET current_published_version_id=$2 WHERE id=$1",
					[documentId, versionId]
				);
				await manager.query(
					`
					INSERT INTO knowledge_chunk_publications(document_id,chunk_set_id) VALUES($1,$2)
					ON CONFLICT(document_id) DO UPDATE SET chunk_set_id=excluded.chunk_set_id`,
					[documentId, setId]
				);
				await updateSafety((safety) => {
					safety.revision = versionId;
					safety.guidance[0] = {
						...unit,
						source,
						currentPublishedVersionId: versionId,
						currentChunkSetId: setId,
						chunkSet: { ...unit.chunkSet, id: setId, documentVersionId: versionId },
						chunkIds: [chunkId],
						pageRefs: [{ ...unit.pageRefs[0], chunkId }],
					};
				}, manager);
			});
			return { setId, chunkId };
		}
		const knowledge = new KnowledgeChunksRepository(db);
		const first = await activate(1);
		await publish();
		await service.generate(await claim());
		const original = await service.readArtifact(tripId, 1);
		const originalHash = (await service.getReadyMetadata(tripId, 1))?.sha256;
		expect(original).toBeInstanceOf(Buffer);
		const second = await activate(2);
		class LockingSources extends FictionalDatabaseSources {
			override async read(manager: EntityManager, core: PackageCore, lock: boolean) {
				if (lock)
					await manager.query("SELECT id FROM survival_documents WHERE id=$1 FOR SHARE", [
						documentId,
					]);
				const inputs = await super.read(manager, core, lock);
				const rows: Array<{ id: string }> = await manager.query(
					"SELECT id FROM knowledge_chunks WHERE id=$1 AND chunk_set_id=$2",
					[second.chunkId, second.setId]
				);
				expect(rows).toHaveLength(1);
				if (lock)
					expect(await knowledge.cleanupHistory(7)).toEqual({
						deleted: 0,
						retainedByDependency: 0,
					});
				return inputs;
			}
		}
		await service.requestImpact(tripId, "new-survival-version");
		await generator(new LockingSources()).generate(await claim());
		expect((await service.getManifest(tripId, 2))?.guidance[0].chunkSetId).toBe(second.setId);
		expect(await knowledge.cleanupHistory(7)).toEqual({ deleted: 1, retainedByDependency: 0 });
		expect(await db.query("SELECT id FROM knowledge_chunks WHERE id=$1", [first.chunkId])).toEqual(
			[]
		);
		const retained = await service.readArtifact(tripId, 1);
		expect(retained).toEqual(original);
		expect(
			createHash("sha256")
				.update(retained as Buffer)
				.digest("hex")
		).toBe(originalHash);
	});
	it("rejects source insert/withdrawal during artifact construction", async () => {
		await publish();
		const put = storage.put.bind(storage);
		jest.spyOn(storage, "put").mockImplementation(async (key, bytes) => {
			await put(key, bytes);
			await updateSafety((input) => {
				input.revision = "withdrawal";
				input.guidance = [];
			});
		});
		await expect(service.generate(await claim())).rejects.toMatchObject({
			reasons: [PackageReason.SOURCE_CHANGED],
		});
		expect(await repo.ready(tripId)).toBeNull();
	});
	it("fences a concurrent core insert with the final SHARE lock", async () => {
		await publish();
		const put = storage.put.bind(storage);
		jest.spyOn(storage, "put").mockImplementation(async (key, bytes) => {
			await put(key, bytes);
			await db.query("UPDATE checkpoints SET instructions='changed' WHERE route_id=$1", [routeId]);
		});
		await expect(service.generate(await claim())).rejects.toMatchObject({
			reasons: [PackageReason.SOURCE_CHANGED],
		});
		const runner = db.createQueryRunner();
		await runner.startTransaction();
		try {
			await new PackageCoreReader().read(runner.manager, tripId, true);
			await expect(
				db.transaction(async (manager) => {
					await manager.query("SET LOCAL lock_timeout='100ms'");
					await manager.query(
						"UPDATE checkpoints SET instructions='concurrent' WHERE route_id=$1",
						[routeId]
					);
				})
			).rejects.toThrow();
		} finally {
			await runner.rollbackTransaction();
			await runner.release();
		}
	});
	it("recovers an expired lease and refuses the stale worker", async () => {
		await publish();
		const first = await claim();
		await db.query(
			"UPDATE offline_package_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
			[first.id]
		);
		const recovered = await claim();
		expect(recovered.id).toBe(first.id);
		expect(recovered.lease_token).not.toBe(first.lease_token);
		expect(await repo.heartbeat(first)).toBe(false);
		await expect(service.generate(first)).rejects.toMatchObject({
			reasons: [PackageReason.LEASE_LOST],
		});
		await service.generate(recovered);
		expect((await repo.ready(tripId))?.package_version).toBe(1);
	});
	it("bounds retries and records an exhausted worker crash", async () => {
		await publish();
		for (let attempt = 1; attempt <= 3; attempt++) {
			const job = await claim();
			expect(job.attempts).toBe(attempt);
			await db.query(
				"UPDATE offline_package_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
				[job.id]
			);
		}
		expect(await repo.claim()).toBeNull();
		const jobs: PackageJob[] = await db.query("SELECT * FROM offline_package_jobs");
		expect(jobs[0].status).toBe(PackageJobStatus.FAILED);
		expect(jobs[0].reason_codes).toEqual([PackageReason.LEASE_LOST]);
	});
	it("retains retryable technical failures with bounded backoff", async () => {
		await publish();
		const job = await claim();
		await repo.fail(job, new PackageFailure([PackageReason.GENERATION_FAILED], true));
		expect((await repo.status(tripId, job.id))?.status).toBe(PackageJobStatus.RETRYABLE_FAILED);
		expect(await repo.claim()).toBeNull();
		await db.query(
			"UPDATE offline_package_jobs SET next_attempt_at=clock_timestamp() WHERE id=$1",
			[job.id]
		);
		await service.generate(await claim());
		expect(await repo.ready(tripId)).not.toBeNull();
	});
	it("never publishes when storage write or integrity validation fails", async () => {
		await publish();
		const job = await claim();
		jest.spyOn(storage, "put").mockRejectedValueOnce(new Error("disk unavailable"));
		await expect(service.generate(job)).rejects.toThrow("disk unavailable");
		expect(await repo.ready(tripId)).toBeNull();
		jest
			.spyOn(storage, "read")
			.mockRejectedValueOnce(new PackageFailure([PackageReason.ARTIFACT_INVALID]));
		await expect(service.generate(job)).rejects.toThrow();
		expect(await repo.ready(tripId)).toBeNull();
	});
	it("rolls back metadata if completion fails and collects the orphan", async () => {
		await publish();
		const job = await claim();
		jest.spyOn(repo, "complete").mockRejectedValueOnce(new Error("commit failed"));
		await expect(service.generate(job)).rejects.toThrow("commit failed");
		expect(await repo.ready(tripId)).toBeNull();
		await repo.fail(job, new PackageFailure([PackageReason.GENERATION_FAILED], true));
		await db.query("UPDATE offline_package_artifact_cleanup SET next_cleanup_at=clock_timestamp()");
		await service.cleanupOrphans();
		jest.restoreAllMocks();
		await db.query("UPDATE offline_package_jobs SET next_attempt_at=clock_timestamp()");
		await service.generate(await claim());
		expect(await repo.ready(tripId)).not.toBeNull();
	});
});

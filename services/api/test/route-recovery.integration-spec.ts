import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { unzipSync, zipSync } from "fflate";
import request from "supertest";
import { DataSource } from "typeorm";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";
import { OfflinePackageAccessRepository } from "../src/modules/offline-package-download/offline-package-access.repository";
import { RouteRecoveryController } from "../src/modules/offline-package-download/route-recovery.controller";
import { RouteRecoveryRepository } from "../src/modules/offline-package-download/route-recovery.repository";
import { RouteRecoveryService } from "../src/modules/offline-package-download/route-recovery.service";
import { OfflinePackagesRepository } from "../src/modules/offline-packages/offline-packages.repository";
import { OfflinePackagesService } from "../src/modules/offline-packages/offline-packages.service";
import { UnavailableOfflineSafetySources } from "../src/modules/offline-packages/offline-safety-sources";
import { PackageArtifactBuilder } from "../src/modules/offline-packages/package-artifact.builder";
import { LocalPackageArtifactStorage } from "../src/modules/offline-packages/package-artifact.storage";
import { PackageCoreReader } from "../src/modules/offline-packages/package-core.reader";
import {
	ApprovedGuidanceSelector,
	EligibleHazardResolver,
	PackageEligibilityValidator,
	TripSafetyContextResolver,
	canonical,
	digest,
} from "../src/modules/offline-packages/package-policy";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { UsersRepository } from "../src/modules/users/users.repository";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import { recoveryFixture } from "./support/route-recovery-fixture";

describe("CTMS-315 read-only HTTP, PostgreSQL snapshot and private artifact integration", () => {
	const schema = `recovery_${randomUUID().replace(/-/g, "")}`;
	const tripId = randomUUID();
	const routeId = randomUUID();
	const userId = randomUUID();
	const outsiderId = randomUUID();
	const porterId = randomUUID();
	const fixture = recoveryFixture(tripId, routeId);
	const secret = "ctms315-test-only-jwt-secret";
	const jwt = new JwtService({ secret });
	const users = { findOneWithRolesById: jest.fn(), getGrantedRoles: jest.fn() };
	let db: DataSource;
	let app: INestApplication;
	let root: string;
	let originalRoot: string | undefined;
	let repository: RouteRecoveryRepository;
	let storage: LocalPackageArtifactStorage;
	const endpoint = (id = tripId) => `/trips/${id}/route-recovery/context`;
	const query = { packageId: fixture.metadata.id, packageVersion: 1 };
	const get = (id = tripId, participant = userId) =>
		request(app.getHttpServer())
			.get(endpoint(id))
			.set("Authorization", `Bearer ${jwt.sign({ sub: participant, roles: [UserRole.CAMPER] })}`);

	beforeAll(async () => {
		db = new DataSource({
			type: "postgres",
			url: process.env.TEST_DATABASE_URL,
			extra: { options: `-c search_path=${schema},public`, connectionTimeoutMillis: 3000 },
		});
		await db.initialize();
		await assertSafeTestDatabase(db);
		await db.query(`CREATE EXTENSION IF NOT EXISTS postgis; CREATE SCHEMA ${schema}`);
		await db.query(`CREATE TABLE trips(id uuid PRIMARY KEY,route_id uuid,status text,updated_at timestamptz DEFAULT now());
		 CREATE TABLE trekking_routes(id uuid PRIMARY KEY,route_geom geometry(LineString,4326));
		 CREATE TABLE bookings(id uuid PRIMARY KEY,trip_id uuid,user_id uuid,status text);
		 CREATE TABLE booking_members(id uuid PRIMARY KEY,booking_id uuid,user_id uuid,member_status text,left_at timestamptz);
		 CREATE TABLE trip_porters(trip_id uuid,porter_id uuid,status text);
		 CREATE TABLE offline_packages(id uuid PRIMARY KEY,trip_id uuid,package_version integer,generation_key text,
		 schema_version integer,manifest jsonb,sha256 text,size_bytes integer,artifact_key text,generated_at timestamptz,
		 UNIQUE(trip_id,package_version));`);
		originalRoot = process.env.OFFLINE_PACKAGE_STORAGE_ROOT;
		root = await mkdtemp(join(tmpdir(), "ctms315-"));
		process.env.OFFLINE_PACKAGE_STORAGE_ROOT = root;
		storage = new LocalPackageArtifactStorage();
		const packages = new OfflinePackagesService(
			db,
			new OfflinePackagesRepository(db),
			new PackageCoreReader(),
			new UnavailableOfflineSafetySources(),
			new TripSafetyContextResolver(),
			new EligibleHazardResolver(),
			new ApprovedGuidanceSelector(),
			new PackageEligibilityValidator(),
			new PackageArtifactBuilder(),
			storage
		);
		repository = new RouteRecoveryRepository();
		const service = new RouteRecoveryService(
			db,
			new OfflinePackageAccessRepository(db),
			repository,
			packages
		);
		const module = await Test.createTestingModule({
			imports: [PassportModule],
			controllers: [RouteRecoveryController],
			providers: [
				{ provide: RouteRecoveryService, useValue: service },
				JwtStrategy,
				{ provide: ConfigService, useValue: { get: () => secret } },
				{ provide: UsersRepository, useValue: users },
			],
		}).compile();
		app = module.createNestApplication();
		app.useGlobalPipes(
			new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
	});
	afterAll(async () => {
		await app?.close();
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query(`DROP SCHEMA ${schema} CASCADE`);
			await db.destroy();
		}
		if (originalRoot === undefined)
			Reflect.deleteProperty(process.env, "OFFLINE_PACKAGE_STORAGE_ROOT");
		else process.env.OFFLINE_PACKAGE_STORAGE_ROOT = originalRoot;
		if (root) {
			if (resolve(dirname(root)) !== resolve(tmpdir()) || !basename(root).startsWith("ctms315-"))
				throw new Error("Unexpected test artifact cleanup path");
			await rm(root, { recursive: true, force: true });
		}
	});
	beforeEach(async () => {
		jest.restoreAllMocks();
		users.findOneWithRolesById.mockImplementation(async (id: string) => ({
			id,
			status: UserStatus.ACTIVE,
		}));
		users.getGrantedRoles.mockReturnValue([UserRole.CAMPER]);
		await db.query(
			"TRUNCATE trips,trekking_routes,bookings,booking_members,trip_porters,offline_packages"
		);
		await db.query(
			"INSERT INTO trekking_routes VALUES($1,ST_SetSRID(ST_GeomFromGeoJSON($2),4326))",
			[routeId, JSON.stringify(fixture.geometry)]
		);
		await db.query("INSERT INTO trips(id,route_id,status) VALUES($1,$2,'published')", [
			tripId,
			routeId,
		]);
		const bookingId = randomUUID();
		await db.query("INSERT INTO bookings VALUES($1,$2,$3,'confirmed')", [
			bookingId,
			tripId,
			userId,
		]);
		await db.query("INSERT INTO booking_members VALUES($1,$2,$3,'registered',NULL)", [
			randomUUID(),
			bookingId,
			userId,
		]);
		await db.query("INSERT INTO trip_porters VALUES($1,$2,'assigned')", [tripId, porterId]);
		await insertPackage(fixture);
		await writeFile(join(root, fixture.metadata.artifact_key), fixture.bytes);
	});
	async function insertPackage(value: ReturnType<typeof recoveryFixture>) {
		const m = value.metadata;
		await db.query("INSERT INTO offline_packages VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
			m.id,
			m.trip_id,
			m.package_version,
			m.generation_key,
			m.schema_version,
			m.manifest,
			m.sha256,
			m.size_bytes,
			m.artifact_key,
			m.generated_at,
		]);
	}
	it("publishes a usable OpenAPI schema for the CTMS-316 contract", () => {
		const document = SwaggerModule.createDocument(
			app,
			new DocumentBuilder().addBearerAuth().build()
		);
		expect(
			document.paths["/trips/{tripId}/route-recovery/context"].get?.responses["200"]
		).toMatchObject({
			content: {
				"application/json": { schema: { $ref: "#/components/schemas/RouteRecoveryResponseDto" } },
			},
		});
		expect(document.components?.schemas?.RouteRecoveryResponseDto).toMatchObject({
			properties: {
				geometry: { nullable: true, properties: { coordinates: { type: "array", minItems: 2 } } },
				requested: { required: ["packageId", "packageVersion"] },
				conventions: { properties: { bearingRange: { enum: ["[0,360)"] } } },
			},
		});
	});
	it("returns verified geometry and leaves Trip status/updatedAt and row contents untouched", async () => {
		const before = await db.query("SELECT * FROM trips WHERE id=$1", [tripId]);
		const response = await get().query(query).expect(200);
		expect(response.body).toMatchObject({
			status: "AVAILABLE",
			reason: null,
			geometry: fixture.geometry,
			package: {
				id: query.packageId,
				version: 1,
				routeFingerprint: fixture.manifest.route.fingerprint,
			},
		});
		expect(response.headers["cache-control"]).toBe("private, no-store");
		expect(JSON.stringify(response.body)).not.toContain("artifact_key");
		expect(await db.query("SELECT * FROM trips WHERE id=$1", [tripId])).toEqual(before);
	});
	it("supports assigned Porter, requiring the same actual assignment", async () => {
		users.getGrantedRoles.mockReturnValue([UserRole.PORTER]);
		await get(tripId, porterId).query(query).expect(200);
		await db.query("UPDATE trip_porters SET status='unassigned'");
		await get(tripId, porterId).query(query).expect(404);
	});
	it("normalizes valid uppercase UUIDs without treating the same package as a mismatch", async () => {
		const response = await get(tripId.toUpperCase())
			.query({ ...query, packageId: query.packageId.toUpperCase() })
			.expect(200);
		expect(response.body).toMatchObject({
			status: "AVAILABLE",
			tripId,
			requested: query,
			package: { id: query.packageId },
		});
	});
	it("returns 401 without JWT and 403 for a nonparticipant role", async () => {
		await request(app.getHttpServer()).get(endpoint()).query(query).expect(401);
		users.getGrantedRoles.mockReturnValue([UserRole.HOST]);
		await get().query(query).expect(403);
	});
	it("has identical 404 signatures for unknown Trip, unrelated user and withdrawn member", async () => {
		const missing = await get(randomUUID()).query(query).expect(404);
		const outsider = await get(tripId, outsiderId).query(query).expect(404);
		await db.query("UPDATE booking_members SET left_at=now()");
		const revoked = await get().query(query).expect(404);
		expect(outsider.body).toEqual(missing.body);
		expect(revoked.body).toEqual(missing.body);
	});
	it.each([
		{},
		{ packageId: fixture.metadata.id },
		{ packageVersion: 1 },
		{ ...query, packageId: "bad" },
		{ ...query, packageVersion: 0 },
		{ ...query, packageVersion: 1.5 },
		{ ...query, packageVersion: "NaN" },
		{ ...query, packageVersion: 2147483648 },
		{ ...query, unknown: 1 },
	])("rejects missing/malformed query (%#)", async (invalid) => {
		await get().query(invalid).expect(422);
	});
	it("rejects invalid Trip UUID", async () => {
		await get("bad").query(query).expect(422);
	});
	it.each(["completed", "cancelled", "draft"])(
		"returns explicit unavailable for authorized %s Trip",
		async (status) => {
			await db.query("UPDATE trips SET status=$1", [status]);
			const response = await get().query(query).expect(200);
			expect(response.body).toMatchObject({
				status: "UNAVAILABLE",
				reason: "TRIP_NOT_NAVIGABLE",
				geometry: null,
			});
		}
	);
	it("keeps an ongoing Trip bound to requested v1 when v2 exists", async () => {
		await db.query("UPDATE trips SET status='ongoing'");
		await insertPackage(recoveryFixture(tripId, routeId, 2));
		const response = await get().query(query).expect(200);
		expect(response.body).toMatchObject({
			status: "STALE",
			reason: "NEWER_PACKAGE_AVAILABLE",
			package: { id: query.packageId, version: 1 },
			geometry: fixture.geometry,
			current: { latestPackageVersion: 2 },
		});
	});
	it("returns mismatch/null for wrong UUID, and unavailable/null for absent exact version", async () => {
		const mismatch = await get()
			.query({ ...query, packageId: randomUUID() })
			.expect(200);
		expect(mismatch.body).toMatchObject({ status: "MISMATCH", geometry: null, package: null });
		const absent = await get()
			.query({ ...query, packageVersion: 99 })
			.expect(200);
		expect(absent.body).toMatchObject({
			status: "UNAVAILABLE",
			reason: "PACKAGE_NOT_FOUND",
			geometry: null,
		});
	});
	it("maps corrupted private artifact to UNAVAILABLE instead of 500", async () => {
		await writeFile(join(root, fixture.metadata.artifact_key), Buffer.alloc(fixture.bytes.length));
		const response = await get().query(query).expect(200);
		expect(response.body).toMatchObject({
			status: "UNAVAILABLE",
			reason: "ARTIFACT_UNAVAILABLE",
			geometry: null,
		});
	});
	it("maps a missing private artifact to UNAVAILABLE", async () => {
		await rm(join(root, fixture.metadata.artifact_key));
		const response = await get().query(query).expect(200);
		expect(response.body).toMatchObject({
			status: "UNAVAILABLE",
			reason: "ARTIFACT_UNAVAILABLE",
			geometry: null,
		});
	});
	it("does not return another Route's package geometry", async () => {
		const otherRoute = recoveryFixture(tripId, randomUUID(), 2);
		await insertPackage(otherRoute);
		await writeFile(join(root, otherRoute.metadata.artifact_key), otherRoute.bytes);
		const response = await get()
			.query({ packageId: otherRoute.metadata.id, packageVersion: 2 })
			.expect(200);
		expect(response.body).toMatchObject({
			status: "MISMATCH",
			reason: "ROUTE_ID_MISMATCH",
			geometry: null,
		});
	});
	it("maps valid-checksum but unparseable route payload to UNAVAILABLE", async () => {
		const files = unzipSync(fixture.bytes);
		files["route.geojson"] = Buffer.from("invalid-json");
		const manifest = structuredClone(fixture.manifest);
		const entry = manifest.files.find((file) => file.path === "route.geojson");
		if (!entry) throw new Error("Missing fixture route");
		entry.sha256 = digest(Buffer.from(files["route.geojson"]));
		entry.sizeBytes = files["route.geojson"].length;
		files["manifest.json"] = Buffer.from(canonical(manifest));
		const bytes = Buffer.from(zipSync(files));
		const sha = digest(bytes);
		await writeFile(join(root, `${sha}.zip`), bytes);
		await db.query(
			"UPDATE offline_packages SET manifest=$1,sha256=$2,size_bytes=$3,artifact_key=$4",
			[manifest, sha, bytes.length, `${sha}.zip`]
		);
		const response = await get().query(query).expect(200);
		expect(response.body).toMatchObject({
			status: "UNAVAILABLE",
			reason: "ARTIFACT_UNAVAILABLE",
			geometry: null,
		});
	});
	it("uses one snapshot if Route and package publication change between reads", async () => {
		const original = repository.route.bind(repository);
		jest.spyOn(repository, "route").mockImplementationOnce(async (manager, trip) => {
			expect(await manager.query("SHOW transaction_read_only")).toEqual([
				{ transaction_read_only: "on" },
			]);
			expect(await manager.query("SHOW transaction_isolation")).toEqual([
				{ transaction_isolation: "repeatable read" },
			]);
			const snapshot = await original(manager, trip);
			// A second connection commits while the first READ ONLY transaction remains open.
			await db.query("UPDATE trekking_routes SET route_geom=ST_Translate(route_geom,0.1,0.1)");
			await insertPackage(recoveryFixture(tripId, routeId, 2));
			// A later statement must still see the original MVCC snapshot, not the new version.
			expect(
				await manager.query(
					"SELECT max(package_version) AS version FROM offline_packages WHERE trip_id=$1",
					[tripId]
				)
			).toEqual([{ version: 1 }]);
			return snapshot;
		});
		const beforeChange = await get().query(query).expect(200);
		expect(beforeChange.body).toMatchObject({
			status: "AVAILABLE",
			geometry: fixture.geometry,
			current: { latestPackageVersion: 1, routeFingerprint: fixture.manifest.route.fingerprint },
		});
		const afterChange = await get().query(query).expect(200);
		expect(afterChange.body).toMatchObject({
			status: "STALE",
			reason: "ROUTE_VERSION_CHANGED",
			geometry: fixture.geometry,
			current: { latestPackageVersion: 2 },
		});
		expect(afterChange.body.current.routeFingerprint).not.toBe(fixture.manifest.route.fingerprint);
	});
	it("fails closed when participation is revoked during artifact verification", async () => {
		const original = storage.read.bind(storage);
		jest.spyOn(storage, "read").mockImplementationOnce(async (...args) => {
			const bytes = await original(...args);
			await db.query("UPDATE booking_members SET left_at=now()");
			return bytes;
		});
		await get().query(query).expect(404);
	});
});

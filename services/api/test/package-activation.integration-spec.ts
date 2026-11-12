import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { CreatePackageActivationPolicy1795100000000 } from "../src/migrations/1795100000000-CreatePackageActivationPolicy";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";
import { PackageDepartureNotificationsController } from "../src/modules/offline-package-download/package-departure-notifications.controller";
import { PackageFreshnessController } from "../src/modules/offline-package-download/package-freshness.controller";
import { PackageActivationService } from "../src/modules/offline-packages/package-activation.service";
import { PackageArtifactBuilder } from "../src/modules/offline-packages/package-artifact.builder";
import { PackageArtifactStorage } from "../src/modules/offline-packages/package-artifact.storage";
import { PackageDepartureNotificationsService } from "../src/modules/offline-packages/package-departure-notifications.service";
import type { PackageSourceFreshness } from "../src/modules/offline-packages/package-freshness.source";
import { Trip, TripStatus } from "../src/modules/trips/entities/trip.entity";
import { TripsRepository } from "../src/modules/trips/repositories/trips.repository";
import { TripStatusScheduleService } from "../src/modules/trips/services/trip-status-schedule.service";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { UsersRepository } from "../src/modules/users/users.repository";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";
import { recoveryFixture } from "./support/route-recovery-fixture";

class MemoryArtifacts extends PackageArtifactStorage {
	readonly files = new Map<string, Buffer>();
	async read(key: string): Promise<Buffer> {
		const file = this.files.get(key);
		if (!file) throw Error("missing");
		return file;
	}
	async put(key: string, bytes: Buffer): Promise<void> {
		this.files.set(key, bytes);
	}
	async remove(key: string): Promise<void> {
		this.files.delete(key);
	}
	async cleanupTemporary(): Promise<void> {}
}

describe("CTMS-305 real PostgreSQL policy, HTTP validation and atomic departure", () => {
	const schema = `activation_${randomUUID().replace(/-/g, "")}`;
	const tripId = randomUUID();
	const userId = randomUUID();
	const hostId = randomUUID();
	const outsider = randomUUID();
	const deviceId = randomUUID();
	const first = recoveryFixture(tripId);
	const second = recoveryFixture(tripId, first.metadata.manifest.route.routeId, 2);
	let db: DataSource;
	let app: INestApplication;
	let service: PackageActivationService;
	let state: PackageSourceFreshness["state"] = "current";
	const storage = new MemoryArtifacts();
	const input = () => ({
		deviceId,
		packageId: first.metadata.id,
		status: "active" as const,
		sha256: first.sha256,
	});
	const secret = "ctms305-test-only-secret";
	const jwt = new JwtService({ secret });
	const users = { findOneWithRolesById: jest.fn(), getGrantedRoles: jest.fn() };
	const bearer = (id = userId) => `Bearer ${jwt.sign({ sub: id, roles: [UserRole.PORTER] })}`;
	const url = `/trips/${tripId}/offline-package-policy`;
	beforeAll(async () => {
		db = await new DataSource({
			type: "postgres",
			url: process.env.TEST_DATABASE_URL,
			extra: { options: `-c search_path=${schema},public` },
		}).initialize();
		await assertSafeTestDatabase(db);
		await db.query(`CREATE SCHEMA ${schema};
   CREATE TABLE users(id uuid PRIMARY KEY);
   CREATE TABLE trips(id uuid PRIMARY KEY,host_id uuid,status text,starts_at timestamptz DEFAULT now()-interval '1 hour',ends_at timestamptz DEFAULT now()+interval '1 day',updated_at timestamptz DEFAULT now(),weather_paused_at timestamptz,participation_evaluated_at timestamptz);
   CREATE TABLE trip_porters(trip_id uuid,porter_id uuid,status text);
   CREATE TABLE bookings(id uuid PRIMARY KEY,trip_id uuid,status text);
   CREATE TABLE booking_members(booking_id uuid,user_id uuid,member_status text,left_at timestamptz);
   CREATE TABLE offline_packages(id uuid PRIMARY KEY,trip_id uuid,package_version int,generation_key text,schema_version int,manifest jsonb,sha256 text,size_bytes int,artifact_key text,generated_at timestamptz,UNIQUE(id,trip_id));
   CREATE TABLE audit_logs(actor_id uuid,action text,target_type text,target_id uuid,"before" jsonb,"after" jsonb,reason text);`);
		const runner = db.createQueryRunner();
		await new CreatePackageActivationPolicy1795100000000().up(runner);
		await runner.release();
		service = new PackageActivationService(
			db,
			{
				read: async () => ({
					state,
					expiresAt: null,
					reasonCodes: state === "unknown" ? ["SOURCE_FRESHNESS_UNAVAILABLE"] : [],
				}),
			},
			storage,
			new PackageArtifactBuilder()
		);
		const module = await Test.createTestingModule({
			imports: [PassportModule],
			controllers: [PackageFreshnessController, PackageDepartureNotificationsController],
			providers: [
				{ provide: PackageActivationService, useValue: service },
				{
					provide: PackageDepartureNotificationsService,
					useValue: new PackageDepartureNotificationsService(db),
				},
				JwtStrategy,
				{ provide: ConfigService, useValue: { get: () => secret } },
				{ provide: UsersRepository, useValue: users },
			],
		}).compile();
		app = module.createNestApplication();
		await app.init();
	}, 60000);
	beforeEach(async () => {
		users.findOneWithRolesById.mockImplementation(async (id: string) => ({
			id,
			status: UserStatus.ACTIVE,
		}));
		users.getGrantedRoles.mockReturnValue([UserRole.PORTER]);
		await db.query(
			"TRUNCATE offline_package_departures,offline_package_requirements,offline_package_device_reports,offline_packages,trip_porters,booking_members,bookings,trips,users,audit_logs CASCADE"
		);
		await db.query("INSERT INTO users VALUES($1),($2),($3)", [userId, outsider, hostId]);
		await db.query("INSERT INTO trips(id,host_id,status) VALUES($1,$2,'published')", [
			tripId,
			hostId,
		]);
		await db.query("INSERT INTO trip_porters VALUES($1,$2,'assigned')", [tripId, userId]);
		state = "current";
		storage.files.clear();
		for (const f of [first, second]) {
			const p = f.metadata;
			await db.query("INSERT INTO offline_packages VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
				p.id,
				p.trip_id,
				p.package_version,
				p.generation_key,
				p.schema_version,
				p.manifest,
				p.sha256,
				p.size_bytes,
				p.artifact_key,
				p.generated_at,
			]);
			await storage.put(p.artifact_key, f.bytes);
		}
	});
	afterAll(async () => {
		await app?.close();
		if (db?.isInitialized) {
			await db.query(`DROP SCHEMA ${schema} CASCADE`);
			await db.destroy();
		}
	});
	const requireFirst = () =>
		db.transaction((m) => service.requirePackage(m, tripId, first.metadata.id));
	async function ready() {
		await requireFirst();
		await service.report(userId, tripId, input());
		await service.confirmDeparture(userId, tripId, input());
	}

	it("keeps integrity, publication and source expiry independent, and GET read-only", async () => {
		await service.report(userId, tripId, input());
		state = "expired";
		const [before] = await db.query("SELECT * FROM trips WHERE id=$1", [tripId]);
		const result = await service.context(userId, tripId, deviceId, first.metadata.id);
		expect(result.integrity.state).toBe("client_reported_verified");
		expect(result.publication.newerAvailable).toBe(true);
		expect(result.sourceFreshness.state).toBe("expired");
		expect(result.replaceAllowed).toBe(true);
		expect((await db.query("SELECT * FROM trips WHERE id=$1", [tripId]))[0]).toEqual(before);
	});
	it("reports are idempotent and never downgrade verification", async () => {
		await service.report(userId, tripId, input());
		const [before] = await db.query("SELECT * FROM offline_package_device_reports");
		await service.report(userId, tripId, input());
		await service.report(userId, tripId, { ...input(), status: "downloaded", sha256: undefined });
		expect(await db.query("SELECT * FROM offline_package_device_reports")).toEqual([before]);
	});
	it("download-only report never claims hash verification", async () => {
		const result = await service.report(userId, tripId, {
			...input(),
			status: "downloaded",
			sha256: undefined,
		});
		expect(result.verificationEvidence).toBe("CLIENT_REPORTED_DOWNLOAD");
		const context = await service.context(userId, tripId, deviceId, first.metadata.id);
		expect(context.integrity.state).toBe("unknown");
		expect(context.deviceReport?.state).toBe("downloaded");
	});
	it("duplicate responsible confirmation preserves its first timestamp", async () => {
		await ready();
		const [before] = await db.query("SELECT * FROM offline_package_departures");
		await service.confirmDeparture(userId, tripId, input());
		expect(await db.query("SELECT * FROM offline_package_departures")).toEqual([before]);
	});
	it("transition path without enabled gate retains legacy behavior even when a requirement exists", async () => {
		await requireFirst();
		const repository = new TripsRepository(Trip, db.manager);
		const config = { get: () => "false" } as unknown as ConfigService;
		await new TripStatusScheduleService(repository, config, service).advanceDueTrips(10);
		expect((await db.query("SELECT status FROM trips"))[0].status).toBe("ongoing");
		expect(await db.query("SELECT * FROM offline_package_departures")).toHaveLength(0);
	});
	it("rejects wrong Trip package, hash mismatch and missing artifact", async () => {
		await expect(
			service.report(userId, tripId, { ...input(), packageId: randomUUID() })
		).rejects.toMatchObject({ response: { code: "PACKAGE_TRIP_MISMATCH" } });
		await expect(
			service.report(userId, tripId, { ...input(), sha256: "0".repeat(64) })
		).rejects.toMatchObject({ response: { code: "PACKAGE_HASH_MISMATCH" } });
		storage.files.clear();
		await expect(service.report(userId, tripId, input())).rejects.toMatchObject({
			response: { code: "PACKAGE_ARTIFACT_UNAVAILABLE" },
		});
	});
	it.each(["ongoing", "completed", "cancelled"])(
		"rejects replacement during %s with stable codes",
		async (status) => {
			await db.query("UPDATE trips SET status=$1", [status]);
			await expect(service.report(userId, tripId, input())).rejects.toMatchObject({
				response: {
					code: status === "ongoing" ? "PACKAGE_VERSION_LOCKED" : "PACKAGE_TRIP_NOT_PUBLISHED",
				},
			});
			const result = await service.context(userId, tripId, deviceId, first.metadata.id);
			expect(result.publication.newerAvailable).toBe(true);
			expect(result.replaceAllowed).toBe(false);
		}
	);
	it("denies outsiders without disclosing Trip existence", async () => {
		await expect(
			service.context(outsider, tripId, deviceId, first.metadata.id)
		).rejects.toMatchObject({ status: 404 });
	});
	it("requires assigned Porter readiness, current authoritative package and source", async () => {
		await requireFirst();
		expect(await db.transaction((m) => service.assertDepartureReady(m, tripId))).toEqual({
			ready: false,
			reasonCode: "PACKAGE_DEPARTURE_NOT_READY",
		});
		await ready();
		state = "unknown";
		expect((await db.transaction((m) => service.assertDepartureReady(m, tripId))).reasonCode).toBe(
			"SOURCE_FRESHNESS_UNAVAILABLE"
		);
		state = "expired";
		expect((await db.transaction((m) => service.assertDepartureReady(m, tripId))).reasonCode).toBe(
			"PACKAGE_SOURCE_EXPIRED"
		);
	});
	it("new requirement published before departure blocks the stale confirmation", async () => {
		await ready();
		await db.transaction((m) => service.requirePackage(m, tripId, second.metadata.id));
		expect((await db.transaction((m) => service.assertDepartureReady(m, tripId))).ready).toBe(
			false
		);
		expect(
			(await db.query("SELECT locked_at FROM offline_package_departures"))[0].locked_at
		).toBeNull();
	});
	it("new optional package between confirmation and worker does not replace the confirmed required package", async () => {
		await db.query("DELETE FROM offline_packages WHERE id=$1", [second.metadata.id]);
		await ready();
		const p = second.metadata;
		await db.query("INSERT INTO offline_packages VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
			p.id,
			p.trip_id,
			p.package_version,
			p.generation_key,
			p.schema_version,
			p.manifest,
			p.sha256,
			p.size_bytes,
			p.artifact_key,
			p.generated_at,
		]);
		const repository = new TripsRepository(Trip, db.manager);
		await repository.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, (m, id) =>
			service.assertDepartureReady(m, id)
		);
		const context = await service.context(userId, tripId, deviceId, first.metadata.id);
		expect(context.lockedPackageId).toBe(first.metadata.id);
		expect(context.publication.newerAvailable).toBe(true);
		expect(context.replaceAllowed).toBe(false);
	});
	it("blocked worker retries persist a visible reason without duplicate audits and recover after readiness", async () => {
		await requireFirst();
		const repository = new TripsRepository(Trip, db.manager);
		const tick = () =>
			repository.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, (m, id) =>
				service.assertDepartureReady(m, id)
			);
		await tick();
		await tick();
		expect((await db.query("SELECT status FROM trips"))[0].status).toBe("published");
		const context = await service.context(userId, tripId, deviceId, first.metadata.id);
		expect(context.departureCheck?.reasonCode).toBe("PACKAGE_DEPARTURE_NOT_READY");
		expect(context.departureCheck?.checkedAt).toBeTruthy();
		expect(
			await db.query("SELECT * FROM audit_logs WHERE action='offline_package.departure_blocked'")
		).toHaveLength(1);
		await service.report(userId, tripId, input());
		await service.confirmDeparture(userId, tripId, input());
		await tick();
		expect((await db.query("SELECT status FROM trips"))[0].status).toBe("ongoing");
		expect(
			(await service.context(userId, tripId, deviceId, first.metadata.id)).departureCheck
				?.reasonCode
		).toBe("PACKAGE_DEPARTURE_READY");
	});
	it("two workers skip the same locked Trip and never duplicate the version lock or start audit", async () => {
		await ready();
		const repository = new TripsRepository(Trip, db.manager);
		let entered: () => void = () => {
			throw Error("missing barrier");
		};
		let release: () => void = () => {
			throw Error("missing barrier");
		};
		const inside = new Promise<void>((r) => {
			entered = r;
		});
		const wait = new Promise<void>((r) => {
			release = r;
		});
		const firstTick = repository.advanceTripStatusesByTime(
			TripStatus.ONGOING,
			10,
			false,
			async (m, id) => {
				const check = await service.assertDepartureReady(m, id);
				entered();
				await wait;
				return check;
			}
		);
		await inside;
		try {
			expect(
				await repository.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, (m, id) =>
					service.assertDepartureReady(m, id)
				)
			).toEqual([]);
		} finally {
			release();
		}
		await firstTick;
		const [before] = await db.query("SELECT * FROM offline_package_departures");
		await repository.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, (m, id) =>
			service.assertDepartureReady(m, id)
		);
		expect(await db.query("SELECT * FROM offline_package_departures")).toEqual([before]);
		expect(
			await db.query("SELECT * FROM audit_logs WHERE action='trip.status_advanced'")
		).toHaveLength(1);
	});
	it("a blocked first Trip does not starve a later due Trip when batch size is one", async () => {
		await requireFirst();
		const later = randomUUID();
		await db.query(
			"INSERT INTO trips(id,host_id,status,starts_at) VALUES($1,$2,'published',now()-interval '30 minutes')",
			[later, hostId]
		);
		const repository = new TripsRepository(Trip, db.manager);
		const moved = await repository.advanceTripStatusesByTime(
			TripStatus.ONGOING,
			1,
			false,
			(m, id) => service.assertDepartureReady(m, id)
		);
		expect(moved.map((row) => row.id)).toEqual([later]);
		expect((await db.query("SELECT status FROM trips WHERE id=$1", [tripId]))[0].status).toBe(
			"published"
		);
	});
	it("durable Host/Porter notifications are deduped on retry, scoped and acknowledgeable", async () => {
		await requireFirst();
		const repository = new TripsRepository(Trip, db.manager);
		const tick = () =>
			repository.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, (m, id) =>
				service.assertDepartureReady(m, id)
			);
		await tick();
		await tick();
		const notifications = new PackageDepartureNotificationsService(db);
		expect(await db.query("SELECT * FROM offline_package_departure_notifications")).toHaveLength(2);
		const porter = await notifications.list(userId);
		expect(porter).toHaveLength(1);
		expect(await notifications.list(hostId)).toHaveLength(1);
		expect(await notifications.list(outsider)).toHaveLength(0);
		await notifications.markRead(userId, porter[0].id);
		const acknowledged = await notifications.list(userId);
		await notifications.markRead(userId, porter[0].id);
		expect(await notifications.list(userId)).toEqual(acknowledged);
		await expect(notifications.markRead(outsider, porter[0].id)).rejects.toMatchObject({
			status: 404,
		});
		await db.query("DELETE FROM trip_porters WHERE porter_id=$1", [userId]);
		expect(await notifications.list(userId)).toHaveLength(0);
	});
	it("blocked notifications roll back with the gate transaction", async () => {
		await requireFirst();
		await expect(
			db.transaction(async (m) => {
				await m.query("SELECT id FROM trips WHERE id=$1 FOR UPDATE", [tripId]);
				await service.assertDepartureReady(m, tripId);
				throw Error("rollback");
			})
		).rejects.toThrow("rollback");
		expect(await db.query("SELECT * FROM offline_package_departure_notifications")).toHaveLength(0);
		expect(await db.query("SELECT * FROM audit_logs")).toHaveLength(0);
	});
	it("members without a downloaded package see blocked state, owning Host sees its inbox", async () => {
		await requireFirst();
		const repository = new TripsRepository(Trip, db.manager);
		await repository.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, (m, id) =>
			service.assertDepartureReady(m, id)
		);
		const booking = randomUUID();
		await db.query("INSERT INTO bookings VALUES($1,$2,'confirmed')", [booking, tripId]);
		await db.query("INSERT INTO booking_members VALUES($1,$2,'joined',NULL)", [booking, outsider]);
		const status = await request(app.getHttpServer())
			.get(`${url}/departure-status`)
			.set("Authorization", bearer(outsider))
			.expect(200);
		expect(status.body.blocked).toBe(true);
		expect(status.body.state).toBe("blocked");
		users.getGrantedRoles.mockReturnValue([UserRole.HOST]);
		await request(app.getHttpServer())
			.get(`${url}/departure-status`)
			.set("Authorization", bearer(hostId))
			.expect(200);
		const inbox = await request(app.getHttpServer())
			.get("/offline-package-notifications")
			.set("Authorization", bearer(hostId))
			.expect(200);
		expect(inbox.body).toHaveLength(1);
		await request(app.getHttpServer())
			.post(`/offline-package-notifications/${inbox.body[0].id}/read`)
			.set("Authorization", bearer(hostId))
			.expect(201);
	});
	it("worker locks the verified version atomically and publisher racing after the lock cannot replace it", async () => {
		await ready();
		let entered: () => void = () => {
			throw Error("Barrier not initialized");
		};
		let release: () => void = () => {
			throw Error("Barrier not initialized");
		};
		const inside = new Promise<void>((r) => {
			entered = r;
		});
		const proceed = new Promise<void>((r) => {
			release = r;
		});
		const repo = new TripsRepository(Trip, db.manager);
		const start = repo.advanceTripStatusesByTime(TripStatus.ONGOING, 10, false, async (m, id) => {
			const result = await service.assertDepartureReady(m, id);
			entered();
			await proceed;
			return result;
		});
		await inside;
		const publication = db.transaction((m) =>
			service.requirePackage(m, tripId, second.metadata.id)
		);
		const rejected = expect(publication).rejects.toMatchObject({
			response: { code: "PACKAGE_VERSION_LOCKED" },
		});
		release();
		await start;
		await rejected;
		const [row] = await db.query(
			"SELECT t.status,d.package_id,d.locked_at FROM trips t JOIN offline_package_departures d ON d.trip_id=t.id"
		);
		expect(row.status).toBe("ongoing");
		expect(row.package_id).toBe(first.metadata.id);
		expect(row.locked_at).toBeInstanceOf(Date);
	});
	it("failed transition rolls back the package lock", async () => {
		await ready();
		await expect(
			db.transaction(async (m) => {
				await m.query("SELECT id FROM trips WHERE id=$1 FOR UPDATE", [tripId]);
				await service.assertDepartureReady(m, tripId);
				throw Error("transition failed");
			})
		).rejects.toThrow("transition failed");
		expect(
			(await db.query("SELECT locked_at FROM offline_package_departures"))[0].locked_at
		).toBeNull();
	});
	it("validates malformed HTTP input without persisting any reports", async () => {
		await request(app.getHttpServer())
			.post(`${url}/device-report`)
			.set("Authorization", bearer())
			.send({ deviceId: "bad", packageId: first.metadata.id, status: "active" })
			.expect(422);
		await request(app.getHttpServer())
			.get(`${url}/context`)
			.set("Authorization", bearer())
			.query({ packageId: first.metadata.id })
			.expect(422);
		expect(await db.query("SELECT * FROM offline_package_device_reports")).toHaveLength(0);
	});
	it("enforces actual JWT/role guards and uniform missing/denied Trip responses", async () => {
		const endpoint = `${url}/context`;
		const query = { deviceId, packageId: first.metadata.id };
		await request(app.getHttpServer()).get(endpoint).query(query).expect(401);
		users.getGrantedRoles.mockReturnValue([UserRole.ADMIN]);
		await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", bearer())
			.query(query)
			.expect(403);
		users.getGrantedRoles.mockReturnValue([UserRole.PORTER]);
		const denied = await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", bearer(outsider))
			.query(query)
			.expect(404);
		const absent = await request(app.getHttpServer())
			.get(`/trips/${randomUUID()}/offline-package-policy/context`)
			.set("Authorization", bearer())
			.query(query)
			.expect(404);
		expect(denied.body.code).toBe("TRIP_NOT_ACCESSIBLE");
		expect(absent.body.code).toBe(denied.body.code);
	});
	it("authenticated HTTP report/context/readiness uses exact required version", async () => {
		await requireFirst();
		await request(app.getHttpServer())
			.post(`${url}/device-report`)
			.set("Authorization", bearer())
			.send(input())
			.expect(201);
		const result = await request(app.getHttpServer())
			.get(`${url}/context`)
			.set("Authorization", bearer())
			.query({ deviceId, packageId: first.metadata.id })
			.expect(200);
		expect(result.body.publication.requiredVersion).toBe(1);
		expect(result.body.publication.latestVersion).toBe(2);
		expect(result.headers["cache-control"]).toBe("private, no-store");
		await request(app.getHttpServer())
			.post(`${url}/departure-ready`)
			.set("Authorization", bearer())
			.send({ deviceId, packageId: first.metadata.id })
			.expect(201);
	});
	it("hash-verified bytes disappearing before departure block the lock", async () => {
		await ready();
		storage.files.clear();
		expect((await db.transaction((m) => service.assertDepartureReady(m, tripId))).reasonCode).toBe(
			"PACKAGE_ARTIFACT_UNAVAILABLE"
		);
		const context = await service.context(userId, tripId, deviceId, first.metadata.id);
		expect(context.integrity.serverArtifact).toBe("unavailable");
		expect(context.integrity.state).toBe("client_reported_verified");
	});
	it("a participating Camper can report but cannot claim the responsible Porter confirmation", async () => {
		await db.query("DELETE FROM trip_porters WHERE trip_id=$1", [tripId]);
		const booking = randomUUID();
		await db.query("INSERT INTO bookings VALUES($1,$2,'confirmed')", [booking, tripId]);
		await db.query("INSERT INTO booking_members VALUES($1,$2,'joined',NULL)", [booking, userId]);
		await service.report(userId, tripId, input());
		await expect(service.confirmDeparture(userId, tripId, input())).rejects.toMatchObject({
			response: { code: "DEPARTURE_RESPONSIBLE_PORTER_REQUIRED" },
		});
	});
	it("additive migration can be reversed without deleting existing Trips or packages", async () => {
		const runner = db.createQueryRunner();
		const migration = new CreatePackageActivationPolicy1795100000000();
		const trips = await db.query("SELECT * FROM trips ORDER BY id");
		const packages = await db.query("SELECT * FROM offline_packages ORDER BY id");
		try {
			await migration.down(runner);
			expect(await db.query("SELECT id FROM trips")).toHaveLength(1);
			expect(await db.query("SELECT id FROM offline_packages")).toHaveLength(2);
		} finally {
			await migration.up(runner);
			await runner.release();
		}
		expect(await db.query("SELECT * FROM trips ORDER BY id")).toEqual(trips);
		expect(await db.query("SELECT * FROM offline_packages ORDER BY id")).toEqual(packages);
	});
});

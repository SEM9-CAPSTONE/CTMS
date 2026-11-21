import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { CreatePackageCamperAcknowledgements1796600001000 } from "../src/migrations/1796600001000-CreatePackageCamperAcknowledgements";
import { JwtStrategy } from "../src/modules/auth/jwt.strategy";
import { PackageFreshnessController } from "../src/modules/offline-package-download/package-freshness.controller";
import { PackageActivationService } from "../src/modules/offline-packages/package-activation.service";
import { PackageArtifactBuilder } from "../src/modules/offline-packages/package-artifact.builder";
import { LocalPackageArtifactStorage } from "../src/modules/offline-packages/package-artifact.storage";
import {
	CAMPER_OFFLINE_NOTICE,
	PackageCamperPreparationService,
} from "../src/modules/offline-packages/package-camper-preparation.service";
import { UnavailablePackageFreshnessSource } from "../src/modules/offline-packages/package-freshness.source";
import { UserRole } from "../src/modules/users/entities/user.entity";
import { UsersRepository } from "../src/modules/users/users.repository";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-431 Camper preparation HTTP and PostgreSQL", () => {
	const schema = `ctms431_${randomUUID().replace(/-/g, "")}`;
	const trip = randomUUID();
	const otherTrip = randomUUID();
	const camper = randomUUID();
	const secondCamper = randomUUID();
	const outsider = randomUUID();
	const porter = randomUUID();
	const required = randomUUID();
	const optional = randomUUID();
	const secret = "camper-preparation-test-only";
	const jwt = new JwtService({ secret });
	let db: DataSource;
	let policy: PackageActivationService;
	let app: INestApplication;

	beforeAll(async () => {
		db = new DataSource({
			type: "postgres",
			url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
			extra: { options: `-c search_path=${schema},public`, connectionTimeoutMillis: 3000 },
		});
		await db.initialize();
		await assertSafeTestDatabase(db);
		await db.query(`CREATE SCHEMA ${schema};
		 CREATE TABLE users(id uuid PRIMARY KEY);
		 CREATE TABLE trips(id uuid PRIMARY KEY,status text NOT NULL,starts_at timestamptz DEFAULT now());
		 CREATE TABLE bookings(id uuid PRIMARY KEY,trip_id uuid,status text);
		 CREATE TABLE booking_members(booking_id uuid,user_id uuid,member_status text,left_at timestamptz);
		 CREATE TABLE offline_packages(id uuid PRIMARY KEY,trip_id uuid,package_version integer,UNIQUE(id,trip_id));
		 CREATE TABLE offline_package_requirements(trip_id uuid PRIMARY KEY,package_id uuid,
		  required_at timestamptz DEFAULT now(),last_checked_at timestamptz,last_reason_code text);
		 CREATE TABLE offline_package_departures(trip_id uuid PRIMARY KEY,package_id uuid,locked_at timestamptz);
		 CREATE TABLE audit_logs(actor_id uuid,action text,target_type text,target_id uuid,"after" jsonb,reason text);`);
		const runner = db.createQueryRunner();
		try {
			await new CreatePackageCamperAcknowledgements1796600001000().up(runner);
		} finally {
			await runner.release();
		}
		await db.query("INSERT INTO users SELECT unnest($1::uuid[])", [
			[camper, secondCamper, outsider, porter],
		]);
		await db.query("INSERT INTO trips(id,status) VALUES($1,'published'),($2,'published')", [
			trip,
			otherTrip,
		]);
		await db.query("INSERT INTO offline_packages VALUES($1,$3,2),($2,$3,3)", [
			required,
			optional,
			trip,
		]);
		policy = new PackageActivationService(
			db,
			new UnavailablePackageFreshnessSource(),
			new LocalPackageArtifactStorage(),
			new PackageArtifactBuilder()
		);
		await db.transaction((m) => policy.requirePackage(m, trip, required));
		const booking = randomUUID();
		await db.query("INSERT INTO bookings VALUES($1,$2,'confirmed')", [booking, trip]);
		await db.query(
			"INSERT INTO booking_members VALUES($1,$2,'registered',NULL),($1,$3,'joined',NULL)",
			[booking, camper, secondCamper]
		);
		const users = {
			findOneWithRolesById: (id: string) => ({ id, role: roleOf(id), status: "active" }),
			getGrantedRoles: (user: { id: string }) => [roleOf(user.id)],
		};
		const module = await Test.createTestingModule({
			imports: [PassportModule],
			controllers: [PackageFreshnessController],
			providers: [
				JwtStrategy,
				PackageCamperPreparationService,
				{ provide: DataSource, useValue: db },
				{ provide: PackageActivationService, useValue: policy },
				{ provide: ConfigService, useValue: { get: () => secret } },
				{ provide: UsersRepository, useValue: users },
			],
		}).compile();
		app = module.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app?.close();
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
			await db.destroy();
		}
	});

	const roleOf = (id: string) => (id === porter ? UserRole.PORTER : UserRole.CAMPER);
	const url = (id = trip) => `/trips/${id}/offline-package-policy/camper-preparation`;
	const auth = (id: string) => `Bearer ${jwt.sign({ sub: id, roles: [roleOf(id)] })}`;
	const body = { packageId: required, policyVersion: CAMPER_OFFLINE_NOTICE, acknowledged: true };
	const api = () => request(app.getHttpServer());
	const post = (id = camper, tripId = trip) =>
		api().post(url(tripId)).set("Authorization", auth(id));

	it("deduplicates concurrent confirmation and scopes it by Camper", async () => {
		const initial = await api().get(url()).set("Authorization", auth(camper)).expect(200);
		expect(initial.body).toMatchObject({
			packageId: required,
			packageVersion: 2,
			confirmedAt: null,
		});
		const outcomes = await Promise.all([
			post().send(body).expect(201),
			post().send(body).expect(201),
		]);
		expect(outcomes[0].body.confirmedAt).toEqual(outcomes[1].body.confirmedAt);
		expect(outcomes[0].body.confirmedAt).toEqual(expect.any(String));
		const other = await api().get(url()).set("Authorization", auth(secondCamper)).expect(200);
		expect(other.body.confirmedAt).toBeNull();
		expect(await db.query("SELECT actor_id FROM audit_logs")).toEqual([{ actor_id: camper }]);
		expect(await db.query("SELECT * FROM offline_package_departures")).toEqual([]);
	});

	it("rejects anonymous, nonmember, wrong role, foreign context and unchecked acknowledgements", async () => {
		await api().get(url()).expect(401);
		await post(outsider).send(body).expect(404);
		await post(porter).send(body).expect(403);
		await post(camper, otherTrip).send(body).expect(404);
		await post()
			.send({ ...body, userId: outsider })
			.expect(422);
		await post()
			.send({ ...body, acknowledged: false })
			.expect(422);
		await post()
			.send({ ...body, packageId: optional })
			.expect(409);
	});

	it("reopens preparation when the required package changes", async () => {
		await post().send(body).expect(201);
		await db.transaction((m) => policy.requirePackage(m, trip, optional));
		const next = await api().get(url()).set("Authorization", auth(camper)).expect(200);
		expect(next.body).toMatchObject({
			packageId: optional,
			packageVersion: 3,
			confirmedAt: null,
		});
		await post().send(body).expect(409);
		await post()
			.send({ ...body, packageId: optional })
			.expect(201);
	});
});

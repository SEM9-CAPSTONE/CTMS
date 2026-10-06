import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { PorterRouteQualificationsService } from "../src/modules/profiles/services/porter-route-qualifications.service";
import { UserRole } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface TestActor {
	id: string;
	token: string;
}

interface QualificationBody {
	qualificationId: string;
	porterId: string;
	routeId: string;
	proficiency: string;
	timesLed: number;
	verifiedBy: string | null;
	verifiedAt: string | null;
	version: number;
}

describe("CTMS-199 Porter profiles and Route qualifications (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let qualificationsService: PorterRouteQualificationsService;
	const userIds = new Set<string>();
	const routeIds = new Set<string>();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix("api");
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				exceptionFactory: validationExceptionFactory,
			})
		);
		await app.init();
		dataSource = moduleRef.get(DataSource);
		jwtService = moduleRef.get(JwtService);
		qualificationsService = moduleRef.get(PorterRouteQualificationsService);
	});

	afterEach(async () => {
		await disableAuditFailure();
		await disableQualificationInsertDelay();
		const ids = [...userIds];
		const routes = [...routeIds];
		if (ids.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[ids]
			);
		}
		if (routes.length > 0) {
			await dataSource.query(
				'DELETE FROM "porter_route_qualifications" WHERE "route_id" = ANY($1)',
				[routes]
			);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routes]);
		}
		if (ids.length > 0) {
			await dataSource.query('DELETE FROM "porter_profiles" WHERE "porter_id" = ANY($1)', [ids]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [ids]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [ids]);
		}
		userIds.clear();
		routeIds.clear();
	});

	afterAll(async () => {
		await app.close();
	});

	async function createActor(role: UserRole, fullName: string): Promise<TestActor> {
		const id = randomUUID();
		userIds.add(id);
		await dataSource.query(
			`INSERT INTO "users" (id, email, password_hash, role, status, full_name)
			 VALUES ($1, $2, 'unused', $3, 'active', $4)`,
			[id, `ctms199-${id}@example.com`, role, fullName]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		return { id, token: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function addRole(actorId: string, role: UserRole): Promise<void> {
		await dataSource.query(
			'INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2) ON CONFLICT DO NOTHING',
			[actorId, role]
		);
	}

	async function createRoute(hostId: string, name = "CTMS-199 Route"): Promise<string> {
		const id = randomUUID();
		routeIds.add(id);
		await dataSource.query(
			`INSERT INTO "trekking_routes" (
				id, host_id, name, route_geom, length_meters, difficulty,
				expected_duration_minutes, status
			) VALUES (
				$1, $2, $3,
				ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'),
				2500, 'moderate', 180, 'active'
			)`,
			[id, hostId, `${name}-${id}`]
		);
		return id;
	}

	async function createProfile(actor: TestActor): Promise<void> {
		await request(app.getHttpServer())
			.patch("/api/porter/profile")
			.set("Authorization", `Bearer ${actor.token}`)
			.send({ experienceYears: 2 })
			.expect(200);
	}

	async function createQualification(
		porter: TestActor,
		routeId: string,
		proficiency = "proficient",
		timesLed = 2
	): Promise<QualificationBody> {
		const response = await request(app.getHttpServer())
			.put(`/api/porter/route-qualifications/${routeId}`)
			.set("Authorization", `Bearer ${porter.token}`)
			.send({ proficiency, timesLed })
			.expect(200);
		return response.body as QualificationBody;
	}

	async function enableAuditFailure(action: string): Promise<void> {
		await dataSource.query(`
			CREATE OR REPLACE FUNCTION ctms199_fail_audit_insert() RETURNS trigger AS $$
			BEGIN
				IF NEW.action = '${action}' THEN
					RAISE EXCEPTION 'forced CTMS-199 audit failure';
				END IF;
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql
		`);
		await dataSource.query(`
			CREATE TRIGGER ctms199_fail_audit_trigger
			BEFORE INSERT ON "audit_logs"
			FOR EACH ROW EXECUTE FUNCTION ctms199_fail_audit_insert()
		`);
	}

	async function disableAuditFailure(): Promise<void> {
		await dataSource.query('DROP TRIGGER IF EXISTS "ctms199_fail_audit_trigger" ON "audit_logs"');
		await dataSource.query("DROP FUNCTION IF EXISTS ctms199_fail_audit_insert()");
	}

	async function enableQualificationInsertDelay(): Promise<void> {
		await dataSource.query(`
			CREATE OR REPLACE FUNCTION ctms199_delay_qualification_insert() RETURNS trigger AS $$
			BEGIN
				PERFORM pg_sleep(0.25);
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql
		`);
		await dataSource.query(`
			CREATE TRIGGER ctms199_delay_qualification_insert_trigger
			BEFORE INSERT ON "porter_route_qualifications"
			FOR EACH ROW EXECUTE FUNCTION ctms199_delay_qualification_insert()
		`);
	}

	async function disableQualificationInsertDelay(): Promise<void> {
		await dataSource.query(
			'DROP TRIGGER IF EXISTS "ctms199_delay_qualification_insert_trigger" ON "porter_route_qualifications"'
		);
		await dataSource.query("DROP FUNCTION IF EXISTS ctms199_delay_qualification_insert()");
	}

	describe("Porter profile", () => {
		it("returns version-zero defaults without persisting, then lazy-creates normalized version one", async () => {
			const porter = await createActor(UserRole.PORTER, "Porter Default");

			const initial = await request(app.getHttpServer())
				.get("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.expect(200);
			expect(initial.body).toMatchObject({
				porterId: porter.id,
				experienceYears: 0,
				certifications: [],
				languages: [],
				availabilityStatus: "unavailable",
				ratingAvg: 0,
				completedTrips: 0,
				version: 0,
				createdAt: null,
				updatedAt: null,
			});
			const beforeRows = await dataSource.query(
				'SELECT 1 FROM "porter_profiles" WHERE "porter_id" = $1',
				[porter.id]
			);
			expect(beforeRows).toHaveLength(0);

			const created = await request(app.getHttpServer())
				.patch("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.send({
					experienceYears: 0,
					certifications: [" First Aid ", "first aid", " Wilderness Rescue "],
					languages: [" Vietnamese ", "vietnamese", "English"],
					availabilityStatus: "available",
				})
				.expect(200);
			expect(created.body).toMatchObject({
				version: 1,
				certifications: ["First Aid", "Wilderness Rescue"],
				languages: ["Vietnamese", "English"],
				availabilityStatus: "available",
			});
		});

		it("enforces stale writes and preserves version/timestamp/audit on a no-op", async () => {
			const porter = await createActor(UserRole.PORTER, "Porter Version");
			await createProfile(porter);

			await request(app.getHttpServer())
				.patch("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ experienceYears: 4 })
				.expect(422);
			await request(app.getHttpServer())
				.patch("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ experienceYears: 4, expectedVersion: 99 })
				.expect(409);

			const current = await request(app.getHttpServer())
				.get("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.expect(200);
			const auditBefore = await dataSource.query(
				'SELECT COUNT(*)::int AS count FROM "audit_logs" WHERE "target_id" = $1',
				[porter.id]
			);
			const noOp = await request(app.getHttpServer())
				.patch("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ experienceYears: 2, expectedVersion: current.body.version })
				.expect(200);
			expect(noOp.body.version).toBe(current.body.version);
			expect(noOp.body.updatedAt).toBe(current.body.updatedAt);
			const auditAfter = await dataSource.query(
				'SELECT COUNT(*)::int AS count FROM "audit_logs" WHERE "target_id" = $1',
				[porter.id]
			);
			expect(auditAfter[0].count).toBe(auditBefore[0].count);
		});

		it("rejects protected and compensation fields and proves audit rollback", async () => {
			const porter = await createActor(UserRole.PORTER, "Porter Rollback");
			await createProfile(porter);
			await request(app.getHttpServer())
				.patch("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ expectedVersion: 1, ratingAvg: 5, dayRate: 100 })
				.expect(422);

			await enableAuditFailure("porter_profile.updated");
			await request(app.getHttpServer())
				.patch("/api/porter/profile")
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ experienceYears: 8, expectedVersion: 1 })
				.expect(500);
			await disableAuditFailure();

			const rows = await dataSource.query(
				'SELECT "experience_years", "version" FROM "porter_profiles" WHERE "porter_id" = $1',
				[porter.id]
			);
			expect(rows[0]).toMatchObject({ experience_years: 2, version: 1 });
		});
	});

	describe("Qualification claims, verification, reads, and concurrency", () => {
		it("requires a persisted profile and creates all proficiency values with HTTP 200", async () => {
			const host = await createActor(UserRole.HOST, "Host Claims");
			const porter = await createActor(UserRole.PORTER, "Porter Claims");
			const routeId = await createRoute(host.id);
			await request(app.getHttpServer())
				.put(`/api/porter/route-qualifications/${routeId}`)
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ proficiency: "learning", timesLed: 0 })
				.expect(404);
			await createProfile(porter);
			const created = await createQualification(porter, routeId, "learning", 0);
			expect(created).toMatchObject({
				proficiency: "learning",
				timesLed: 0,
				verifiedBy: null,
				verifiedAt: null,
				version: 1,
			});

			for (const proficiency of ["proficient", "expert"]) {
				const nextRoute = await createRoute(host.id, proficiency);
				const result = await createQualification(porter, nextRoute, proficiency, 1);
				expect(result.proficiency).toBe(proficiency);
			}
		});

		it("uses the named unique constraint for a real concurrent duplicate create", async () => {
			const host = await createActor(UserRole.HOST, "Host Duplicate");
			const porter = await createActor(UserRole.PORTER, "Porter Duplicate");
			const routeId = await createRoute(host.id);
			await createProfile(porter);
			await enableQualificationInsertDelay();

			const attempts = await Promise.all([
				request(app.getHttpServer())
					.put(`/api/porter/route-qualifications/${routeId}`)
					.set("Authorization", `Bearer ${porter.token}`)
					.send({ proficiency: "proficient", timesLed: 2 }),
				request(app.getHttpServer())
					.put(`/api/porter/route-qualifications/${routeId}`)
					.set("Authorization", `Bearer ${porter.token}`)
					.send({ proficiency: "proficient", timesLed: 2 }),
			]);
			await disableQualificationInsertDelay();
			expect(attempts.filter((result) => result.status === 200)).toHaveLength(1);
			expect(attempts.filter((result) => result.status === 409)).toHaveLength(1);
			const rows = await dataSource.query(
				'SELECT * FROM "porter_route_qualifications" WHERE "porter_id" = $1 AND "route_id" = $2',
				[porter.id, routeId]
			);
			expect(rows).toHaveLength(1);
			const constraint = await dataSource.query(
				"SELECT conname FROM pg_constraint WHERE conname = 'UQ_porter_route_qualifications_porter_route'"
			);
			expect(constraint).toHaveLength(1);
		});

		it("verifies by owner, protects Route reads, and clears verification on effective edits only", async () => {
			const host = await createActor(UserRole.HOST, "Owning Host");
			const otherHost = await createActor(UserRole.HOST, "Other Host");
			const admin = await createActor(UserRole.ADMIN, "Admin");
			const porter = await createActor(UserRole.PORTER, "Visible Porter");
			const routeId = await createRoute(host.id);
			await createProfile(porter);
			const claim = await createQualification(porter, routeId);

			await request(app.getHttpServer())
				.get(`/api/trekking-routes/${routeId}/porter-qualifications`)
				.set("Authorization", `Bearer ${otherHost.token}`)
				.expect(403);
			const ownerList = await request(app.getHttpServer())
				.get(`/api/trekking-routes/${routeId}/porter-qualifications`)
				.set("Authorization", `Bearer ${host.token}`)
				.expect(200);
			expect(ownerList.body[0]).toEqual(
				expect.objectContaining({
					qualificationId: claim.qualificationId,
					porterDisplayName: "Visible Porter",
				})
			);
			expect(ownerList.body[0]).not.toHaveProperty("email");
			expect(ownerList.body[0]).not.toHaveProperty("phone");
			await request(app.getHttpServer())
				.get(`/api/trekking-routes/${routeId}/porter-qualifications`)
				.set("Authorization", `Bearer ${admin.token}`)
				.expect(200);

			const verified = await request(app.getHttpServer())
				.patch(`/api/porter/route-qualifications/${claim.qualificationId}/verify`)
				.set("Authorization", `Bearer ${host.token}`)
				.send({ expectedVersion: 1 })
				.expect(200);
			expect(verified.body).toMatchObject({ verifiedBy: host.id, version: 2 });
			expect(verified.body.verifiedAt).toEqual(expect.any(String));
			await expect(qualificationsService.isLeadEligible(porter.id, routeId)).resolves.toBe(true);
			const anotherRoute = await createRoute(host.id, "Exact Route");
			await expect(qualificationsService.isLeadEligible(porter.id, anotherRoute)).resolves.toBe(
				false
			);

			const noOp = await request(app.getHttpServer())
				.put(`/api/porter/route-qualifications/${routeId}`)
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ proficiency: "proficient", timesLed: 2, expectedVersion: 2 })
				.expect(200);
			expect(noOp.body).toMatchObject({ verifiedBy: host.id, version: 2 });

			const changed = await request(app.getHttpServer())
				.put(`/api/porter/route-qualifications/${routeId}`)
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ proficiency: "learning", timesLed: 3, expectedVersion: 2 })
				.expect(200);
			expect(changed.body).toMatchObject({
				verifiedBy: null,
				verifiedAt: null,
				version: 3,
			});
			await expect(qualificationsService.isLeadEligible(porter.id, routeId)).resolves.toBe(false);
		});

		it("allows exactly one concurrent verifier and commits one verification audit", async () => {
			const host = await createActor(UserRole.HOST, "Concurrent Host");
			const admin = await createActor(UserRole.ADMIN, "Concurrent Admin");
			const porter = await createActor(UserRole.PORTER, "Concurrent Porter");
			const routeId = await createRoute(host.id);
			await createProfile(porter);
			const claim = await createQualification(porter, routeId);

			const attempts = await Promise.all([
				request(app.getHttpServer())
					.patch(`/api/porter/route-qualifications/${claim.qualificationId}/verify`)
					.set("Authorization", `Bearer ${host.token}`)
					.send({ expectedVersion: 1 }),
				request(app.getHttpServer())
					.patch(`/api/porter/route-qualifications/${claim.qualificationId}/verify`)
					.set("Authorization", `Bearer ${admin.token}`)
					.send({ expectedVersion: 1 }),
			]);
			expect(attempts.filter((result) => result.status === 200)).toHaveLength(1);
			expect(attempts.filter((result) => result.status === 409)).toHaveLength(1);
			const rows = await dataSource.query(
				`SELECT "version", "verified_by", "verified_at" FROM "porter_route_qualifications"
				 WHERE "id" = $1`,
				[claim.qualificationId]
			);
			expect(rows[0].version).toBe(2);
			expect([host.id, admin.id]).toContain(rows[0].verified_by);
			expect(rows[0].verified_at).not.toBeNull();
			const audits = await dataSource.query(
				`SELECT COUNT(*)::int AS count FROM "audit_logs"
				 WHERE "target_id" = $1 AND "action" = 'porter_route_qualification.verified'`,
				[claim.qualificationId]
			);
			expect(audits[0].count).toBe(1);
		});

		it("blocks self-verification and invalid target state", async () => {
			const porter = await createActor(UserRole.PORTER, "Multi-role Porter");
			await addRole(porter.id, UserRole.HOST);
			const routeId = await createRoute(porter.id);
			await createProfile(porter);
			const claim = await createQualification(porter, routeId);
			await request(app.getHttpServer())
				.patch(`/api/porter/route-qualifications/${claim.qualificationId}/verify`)
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ expectedVersion: 1 })
				.expect(403);

			const host = await createActor(UserRole.HOST, "Validity Host");
			const route2 = await createRoute(host.id);
			const porter2 = await createActor(UserRole.PORTER, "Invalid Porter");
			await createProfile(porter2);
			const claim2 = await createQualification(porter2, route2);
			await dataSource.query('UPDATE "users" SET "status" = $1 WHERE "id" = $2', [
				"suspended",
				porter2.id,
			]);
			await request(app.getHttpServer())
				.patch(`/api/porter/route-qualifications/${claim2.qualificationId}/verify`)
				.set("Authorization", `Bearer ${host.token}`)
				.send({ expectedVersion: 1 })
				.expect(409);
		});

		it("rolls back qualification update and verification when audit insertion fails", async () => {
			const host = await createActor(UserRole.HOST, "Rollback Host");
			const porter = await createActor(UserRole.PORTER, "Rollback Porter");
			const routeId = await createRoute(host.id);
			await createProfile(porter);
			const claim = await createQualification(porter, routeId);

			await enableAuditFailure("porter_route_qualification.updated");
			await request(app.getHttpServer())
				.put(`/api/porter/route-qualifications/${routeId}`)
				.set("Authorization", `Bearer ${porter.token}`)
				.send({ proficiency: "expert", timesLed: 9, expectedVersion: 1 })
				.expect(500);
			await disableAuditFailure();
			let rows = await dataSource.query(
				'SELECT "proficiency", "times_led", "verified_by", "verified_at", "version" FROM "porter_route_qualifications" WHERE "id" = $1',
				[claim.qualificationId]
			);
			expect(rows[0]).toMatchObject({
				proficiency: "proficient",
				times_led: 2,
				verified_by: null,
				verified_at: null,
				version: 1,
			});

			await enableAuditFailure("porter_route_qualification.verified");
			await request(app.getHttpServer())
				.patch(`/api/porter/route-qualifications/${claim.qualificationId}/verify`)
				.set("Authorization", `Bearer ${host.token}`)
				.send({ expectedVersion: 1 })
				.expect(500);
			await disableAuditFailure();
			rows = await dataSource.query(
				'SELECT "verified_by", "verified_at", "version" FROM "porter_route_qualifications" WHERE "id" = $1',
				[claim.qualificationId]
			);
			expect(rows[0]).toMatchObject({ verified_by: null, verified_at: null, version: 1 });
		});
	});
});

import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import type { LevelDecision, LevelPolicy } from "../src/modules/porter-levels/porter-levels.types";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

describe("Porter manual level review (Postgres + HTTP)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	const adminId = randomUUID();
	const porterId = randomUUID();
	const hostId = randomUUID();
	const otherId = randomUUID();
	const routeId = randomUUID();
	const qualificationId = randomUUID();
	const ids = [adminId, porterId, hostId, otherId];
	const policy = {
		expectedVersion: 0,
		name: "Review criteria",
		minExperienceYears: 5,
		minTimesLed: 10,
		requiredSkills: ["Navigation"],
		requiredCertifications: ["First aid"],
		responsibilities: "Lead this Route following Admin review",
	};
	const token = (id: string, role: string) => `Bearer ${jwt.sign({ sub: id, roles: [role] })}`;
	const admin = () => token(adminId, "admin");
	const root = "/api/admin/porter-levels";
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
		db = moduleRef.get(DataSource);
		jwt = moduleRef.get(JwtService);
		for (const [id, role] of [
			[adminId, "admin"],
			[porterId, "porter"],
			[hostId, "host"],
			[otherId, "porter"],
		]) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,'unused',$3,'active','Level integration')",
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
		await db.query(
			"INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status) VALUES($1,$2,'Review Route',ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'),2500,'moderate',180,'active')",
			[routeId, hostId]
		);
		await db.query(
			"INSERT INTO porter_profiles(porter_id,experience_years,certifications,languages) VALUES($1,2,ARRAY['First aid'],ARRAY[]::text[])",
			[porterId]
		);
		await db.query(
			"INSERT INTO porter_verifications(porter_id,status,reviewed_at) VALUES($1,'approved',now())",
			[porterId]
		);
		await db.query(
			"INSERT INTO porter_route_qualifications(id,porter_id,route_id,proficiency,times_led) VALUES($1,$2,$3,'learning',2)",
			[qualificationId, porterId, routeId]
		);
	});
	afterAll(async () => {
		if (db) {
			await db.query("DELETE FROM porter_level_notifications WHERE recipient_id=ANY($1)", [ids]);
			await db.query("DELETE FROM porter_level_notification_outbox WHERE recipient_id=ANY($1)", [
				ids,
			]);
			await db.query("DELETE FROM porter_level_decisions WHERE qualification_id=$1", [
				qualificationId,
			]);
			await db.query("DELETE FROM porter_level_policies WHERE updated_by=$1", [adminId]);
			await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [ids]);
			await db.query("DELETE FROM porter_route_qualifications WHERE id=$1", [qualificationId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [ids]);
		}
		await app?.close();
	});
	async function context(level = "expert") {
		return (
			await request(app.getHttpServer())
				.get(`${root}/qualifications/${qualificationId}/comparison/${level}`)
				.set("Authorization", admin())
				.expect(200)
		).body as {
			qualification: { version: number };
			dossierHash: string;
			policy: LevelPolicy;
			comparison: { experience: boolean };
		};
	}
	async function decision(level = "expert", outcome = "approved") {
		const latest = await context(level);
		return {
			level,
			outcome,
			reason: "Admin has manually reviewed the supporting evidence",
			expectedQualificationVersion: latest.qualification.version,
			expectedPolicyVersion: latest.policy.version,
			expectedDossierHash: latest.dossierHash,
		};
	}
	it("requires Admin, leaves criteria unconfigured, rejects invalid input and closes the legacy bypass", async () => {
		await request(app.getHttpServer()).get(`${root}/policies`).expect(401);
		await request(app.getHttpServer())
			.get(`${root}/policies`)
			.set("Authorization", token(hostId, "host"))
			.expect(403);
		const list = await request(app.getHttpServer())
			.get(`${root}/policies`)
			.set("Authorization", admin())
			.expect(200);
		expect(list.body).toEqual([]);
		await request(app.getHttpServer())
			.put(`${root}/policies/expert`)
			.set("Authorization", admin())
			.send({ ...policy, minTimesLed: -1 })
			.expect(422);
		await request(app.getHttpServer())
			.patch(`/api/porter/route-qualifications/${qualificationId}/verify`)
			.set("Authorization", token(hostId, "host"))
			.send({ expectedVersion: 1 })
			.expect(409);
	});
	it("serializes concurrent policy creation and never changes a qualification when criteria are saved", async () => {
		const save = () =>
			request(app.getHttpServer())
				.put(`${root}/policies/expert`)
				.set("Authorization", admin())
				.send(policy);
		const results = await Promise.all([save(), save()]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
		const [row] = (await db.query(
			"SELECT proficiency,verified_by FROM porter_route_qualifications WHERE id=$1",
			[qualificationId]
		)) as Array<{ proficiency: string; verified_by: string | null }>;
		expect(row).toEqual({ proficiency: "learning", verified_by: null });
	});
	it("stores only own skills and rejects stale dossiers before manual approval", async () => {
		const old = await decision();
		await request(app.getHttpServer())
			.put("/api/porter/level-review/skills")
			.set("Authorization", token(porterId, "porter"))
			.send({ skills: ["Navigation"], expectedVersion: 0 })
			.expect(200);
		await request(app.getHttpServer())
			.post(`${root}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", admin())
			.send(old)
			.expect(409);
		await request(app.getHttpServer())
			.put("/api/porter/level-review/skills")
			.set("Authorization", token(porterId, "porter"))
			.send({ skills: [], expectedVersion: 0 })
			.expect(409);
		const own = await request(app.getHttpServer())
			.get("/api/porter/level-review/skills")
			.set("Authorization", token(otherId, "porter"))
			.expect(200);
		expect(own.body).toEqual({ skills: [], version: 0 });
	});
	it("allows a reasoned manual decision despite advisory mismatch; concurrent retries produce one history row", async () => {
		expect((await context()).comparison).toBeNull();
		const input = await decision();
		const send = () =>
			request(app.getHttpServer())
				.post(`${root}/qualifications/${qualificationId}/decisions`)
				.set("Authorization", admin())
				.send(input);
		const results = await Promise.all([send(), send()]);
		expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
		const history = await request(app.getHttpServer())
			.get(`${root}/qualifications/${qualificationId}/history`)
			.set("Authorization", admin())
			.expect(200);
		expect(history.body).toHaveLength(1);
		expect(history.body[0]).toMatchObject({
			actorId: adminId,
			fromLevel: "learning",
			toLevel: "expert",
			policySnapshot: { version: 1 },
			dossierSnapshot: { experienceYears: 2, skills: ["Navigation"] },
		});
		await request(app.getHttpServer())
			.put(`/api/porter/route-qualifications/${routeId}`)
			.set("Authorization", token(porterId, "porter"))
			.send({ proficiency: "learning", timesLed: 2, expectedVersion: 2 })
			.expect(409);
	});
	it("retains historical criteria after edits, supports manual demotion, and isolates own history", async () => {
		await request(app.getHttpServer())
			.put(`${root}/policies/expert`)
			.set("Authorization", admin())
			.send({ ...policy, name: "Changed criteria", expectedVersion: 1 })
			.expect(200);
		await request(app.getHttpServer())
			.put(`${root}/policies/learning`)
			.set("Authorization", admin())
			.send({ ...policy, minExperienceYears: null, minTimesLed: null })
			.expect(200);
		await request(app.getHttpServer())
			.post(`${root}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", admin())
			.send(await decision("learning"))
			.expect(201);
		const history = await request(app.getHttpServer())
			.get("/api/porter/level-review/history")
			.set("Authorization", token(porterId, "porter"))
			.expect(200);
		const items = history.body as LevelDecision[];
		expect(items).toHaveLength(2);
		expect(items.find((item) => item.toLevel === "expert")?.policySnapshot.definition.name).toBe(
			"Review criteria"
		);
		expect(items[0]).toMatchObject({ fromLevel: "expert", toLevel: "learning" });
		const other = await request(app.getHttpServer())
			.get("/api/porter/level-review/history")
			.set("Authorization", token(otherId, "porter"))
			.expect(200);
		expect(other.body).toEqual([]);
	});
	it("rejects without changing rank and requires approved certificate verification for approval", async () => {
		await db.query(
			"UPDATE porter_verifications SET status='pending_review',reviewed_at=null,updated_at=now() WHERE porter_id=$1",
			[porterId]
		);
		await request(app.getHttpServer())
			.post(`${root}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", admin())
			.send(await decision())
			.expect(409);
		await request(app.getHttpServer())
			.post(`${root}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", admin())
			.send(await decision("expert", "rejected"))
			.expect(409);
		const [row] = (await db.query(
			"SELECT proficiency FROM porter_route_qualifications WHERE id=$1",
			[qualificationId]
		)) as Array<{ proficiency: string }>;
		expect(row.proficiency).toBe("learning");
	});
});

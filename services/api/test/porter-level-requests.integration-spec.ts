import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { LevelNotificationsService } from "../src/modules/porter-levels/level-notifications.service";
import { LevelRequestFilesService } from "../src/modules/porter-levels/level-request-files.service";
import type {
	LevelRequest,
	RequestEvidence,
} from "../src/modules/porter-levels/level-requests.types";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";

interface Detail {
	request: LevelRequest;
	qualification: { version: number };
	policy: { version: number } | null;
	dossierHash: string;
	evidence: RequestEvidence[];
	events: Array<{ toStatus: string }>;
}
describe("Porter level requests state machine (real PostgreSQL + HTTP)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let notifications: LevelNotificationsService;
	let files: LevelRequestFilesService;
	const adminId = randomUUID();
	const admin2Id = randomUUID();
	const porterId = randomUUID();
	const otherId = randomUUID();
	const hostId = randomUUID();
	const routeId = randomUUID();
	const qualificationId = randomUUID();
	const ids = [adminId, admin2Id, porterId, otherId, hostId];
	let requestId: string;
	const allFiles: RequestEvidence[] = [];
	const base = "/api/porter/level-requests";
	const adminBase = "/api/admin/porter-level-requests";
	const levels = "/api/admin/porter-levels";
	const pdf = Buffer.from("%PDF-1.4\n integration evidence\n%%EOF");
	const auth = (id = porterId, role = "porter") => `Bearer ${jwt.sign({ sub: id, roles: [role] })}`;
	beforeAll(async () => {
		const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = module.createNestApplication();
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
		db = module.get(DataSource);
		jwt = module.get(JwtService);
		notifications = module.get(LevelNotificationsService);
		files = module.get(LevelRequestFilesService);
		for (const [id, role] of [
			[adminId, "admin"],
			[admin2Id, "admin"],
			[porterId, "porter"],
			[otherId, "porter"],
			[hostId, "host"],
		]) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,'unused',$3,'active','Request integration')",
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin')", [porterId]);
		await db.query(
			"INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status) VALUES($1,$2,'Request Route',ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'),2500,'moderate',180,'active')",
			[routeId, hostId]
		);
		await db.query(
			"INSERT INTO porter_profiles(porter_id,experience_years,certifications,languages) VALUES($1,2,ARRAY[]::text[],ARRAY[]::text[])",
			[porterId]
		);
		await db.query(
			"INSERT INTO porter_verifications(porter_id,status,reviewed_at) VALUES($1,'approved',now())",
			[porterId]
		);
		await db.query(
			"INSERT INTO porter_route_qualifications(id,porter_id,route_id,proficiency,times_led) VALUES($1,$2,$3,'learning',1)",
			[qualificationId, porterId, routeId]
		);
		for (const level of ["learning", "expert"]) {
			await request(app.getHttpServer())
				.put(`${levels}/policies/${level}`)
				.set("Authorization", auth(adminId, "admin"))
				.send({
					expectedVersion: 0,
					name: `Criteria ${level}`,
					minExperienceYears: null,
					minTimesLed: null,
					requiredSkills: [],
					requiredCertifications: [],
					responsibilities: "Admin manually evaluates responsibility",
				})
				.expect(200);
		}
	});
	afterAll(async () => {
		if (db) {
			await db.query("DROP TRIGGER IF EXISTS porter_request_test_fail ON audit_logs");
			await db.query("DROP FUNCTION IF EXISTS porter_request_test_fail()");
			const evidence = (await db.query(
				'SELECT file_ref AS "fileRef" FROM porter_level_request_evidence WHERE request_id IN (SELECT id FROM porter_level_requests WHERE porter_id=$1)',
				[porterId]
			)) as RequestEvidence[];
			await files.rollback(evidence);
			await db.query("DELETE FROM porter_level_notifications WHERE recipient_id=ANY($1)", [ids]);
			await db.query("DELETE FROM porter_level_notification_outbox WHERE recipient_id=ANY($1)", [
				ids,
			]);
			await db.query("DELETE FROM porter_level_decisions WHERE porter_id=$1", [porterId]);
			await db.query(
				"DELETE FROM porter_level_request_events WHERE request_id IN (SELECT id FROM porter_level_requests WHERE porter_id=$1)",
				[porterId]
			);
			await db.query(
				"DELETE FROM porter_level_request_evidence WHERE request_id IN (SELECT id FROM porter_level_requests WHERE porter_id=$1)",
				[porterId]
			);
			await db.query("DELETE FROM porter_level_requests WHERE porter_id=$1", [porterId]);
			await db.query("DELETE FROM porter_level_policies WHERE updated_by=ANY($1)", [ids]);
			await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [ids]);
			await db.query("DELETE FROM porter_route_qualifications WHERE id=$1", [qualificationId]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [ids]);
		}
		await app?.close();
	});
	async function detail(admin = false): Promise<Detail> {
		return (
			await request(app.getHttpServer())
				.get(`${admin ? adminBase : base}/${requestId}`)
				.set("Authorization", admin ? auth(adminId, "admin") : auth())
				.expect(200)
		).body as Detail;
	}
	async function approveInput() {
		const d = await detail(true);
		return {
			expectedVersion: d.request.version,
			reason: "Reviewed original evidence",
			expectedQualificationVersion: d.qualification.version,
			expectedPolicyVersion: d.policy?.version,
			expectedDossierHash: d.dossierHash,
		};
	}
	const create = (target = "expert", actor = porterId) =>
		request(app.getHttpServer())
			.post(base)
			.set("Authorization", auth(actor))
			.field("routeId", routeId)
			.field("targetLevel", target)
			.field("reason", "Please assess my Route experience")
			.field("expectedQualificationVersion", "1");
	it("enforces role, existing Route claim and strictly higher target", async () => {
		await request(app.getHttpServer())
			.get(adminBase)
			.set("Authorization", auth(hostId, "host"))
			.expect(403);
		await create("expert", otherId).expect(404);
		await create("learning").expect(409);
		await create()
			.attach("files", Buffer.from("fake file"), {
				filename: "fake.pdf",
				contentType: "application/pdf",
			})
			.expect(422);
	});
	it("allows one concurrent open request and preserves the claim's unverified state", async () => {
		const results = await Promise.all([create(), create()]);
		expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
		requestId = (results.find((result) => result.status === 201)?.body as LevelRequest).id;
		const d = await detail();
		expect(d.request.currentVerified).toBe(false);
		expect(d.request.targetLevel).toBe("expert");
		await request(app.getHttpServer())
			.get(`${base}/${requestId}`)
			.set("Authorization", auth(otherId))
			.expect(403);
		const own = await request(app.getHttpServer())
			.get(base)
			.query({ porterId })
			.set("Authorization", auth(otherId))
			.expect(200);
		expect(own.body.items).toEqual([]);
		await request(app.getHttpServer())
			.post(`${base}/${requestId}/evidence`)
			.set("Authorization", auth())
			.field("expectedVersion", String(d.request.version))
			.attach("files", pdf, "proof.pdf")
			.expect(409);
	});
	it("searches request queues by Porter or Route name and treats SQL wildcards as text", async () => {
		for (const [search, total] of [
			["Request Route", 1],
			["does not exist", 0],
			["%", 0],
		] as const) {
			const response = await request(app.getHttpServer())
				.get(adminBase)
				.query({ search })
				.set("Authorization", auth(adminId, "admin"))
				.expect(200);
			expect(response.body.total).toBe(total);
		}
	});
	it("database rejects duplicate open records and mismatched denormalized identity", async () => {
		await expect(
			db.query(
				"INSERT INTO porter_level_requests(qualification_id,porter_id,route_id,current_level,current_verified,target_level,reason,submission_hash) VALUES($1,$2,$3,'learning',false,'expert','duplicate','')",
				[qualificationId, porterId, routeId]
			)
		).rejects.toMatchObject({ driverError: { code: "23505" } });
		await expect(
			db.query(
				"INSERT INTO porter_level_requests(qualification_id,porter_id,route_id,current_level,current_verified,target_level,reason,submission_hash) VALUES($1,$2,$3,'learning',false,'expert','bad identity','')",
				[qualificationId, otherId, routeId]
			)
		).rejects.toMatchObject({ driverError: { code: "23503" } });
	});
	it("blocks direct decisions and claim edits on an open request, including needs-info", async () => {
		const d = await detail(true);
		const blocked = await request(app.getHttpServer())
			.post(`${levels}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", auth(adminId, "admin"))
			.send({
				level: "expert",
				outcome: "approved",
				reason: "Direct change",
				expectedQualificationVersion: d.qualification.version,
				expectedPolicyVersion: d.policy?.version,
				expectedDossierHash: d.dossierHash,
			})
			.expect(409);
		expect(blocked.body).toMatchObject({ code: "OPEN_REQUEST_EXISTS", requestId });
		await request(app.getHttpServer())
			.put(`/api/porter/route-qualifications/${routeId}`)
			.set("Authorization", auth())
			.send({ proficiency: "proficient", timesLed: 2, expectedVersion: 1 })
			.expect(409);
		await request(app.getHttpServer())
			.post(`${adminBase}/${requestId}/request-info`)
			.set("Authorization", auth(adminId, "admin"))
			.send({ expectedVersion: 1, reason: " " })
			.expect(422);
		await request(app.getHttpServer())
			.post(`${adminBase}/${requestId}/request-info`)
			.set("Authorization", auth(adminId, "admin"))
			.send({ expectedVersion: 1, reason: "Upload a certificate" })
			.expect(201);
		await create().expect(409);
	});
	it("requires real changes on resubmit, retains soft-removed files and checks file ownership", async () => {
		let d = await detail();
		await request(app.getHttpServer())
			.post(`${base}/${requestId}/resubmit`)
			.set("Authorization", auth())
			.send({ expectedVersion: d.request.version, reason: d.request.reason })
			.expect(409);
		await request(app.getHttpServer())
			.post(`${base}/${requestId}/evidence`)
			.set("Authorization", auth())
			.field("expectedVersion", String(d.request.version))
			.attach("files", pdf, "first.pdf")
			.expect(201);
		d = await detail();
		allFiles.push(...d.evidence);
		await request(app.getHttpServer())
			.delete(`${base}/${requestId}/evidence/${d.evidence[0].id}`)
			.set("Authorization", auth())
			.send({ expectedVersion: d.request.version })
			.expect(200);
		d = await detail();
		expect(d.evidence[0].removedAt).not.toBeNull();
		await request(app.getHttpServer())
			.get(`${base}/${requestId}/evidence/${d.evidence[0].id}`)
			.set("Authorization", auth(otherId))
			.expect(403);
		await request(app.getHttpServer())
			.get(`${base}/${requestId}/evidence/${d.evidence[0].id}`)
			.set("Authorization", auth())
			.expect(200);
		await request(app.getHttpServer())
			.post(`${base}/${requestId}/evidence`)
			.set("Authorization", auth())
			.field("expectedVersion", String(d.request.version))
			.attach("files", pdf, "retained.pdf")
			.expect(201);
		d = await detail();
		await request(app.getHttpServer())
			.post(`${base}/${requestId}/resubmit`)
			.set("Authorization", auth())
			.send({ expectedVersion: d.request.version, reason: "Added original certificate evidence" })
			.expect(201);
		d = await detail();
		expect(d.request.status).toBe("pending");
		expect(d.events.map((item) => item.toStatus)).toEqual([
			"pending",
			"needs_info",
			"needs_info",
			"needs_info",
			"needs_info",
			"pending",
		]);
	});
	it("forbids self approval and rejects stale dossiers", async () => {
		const input = await approveInput();
		await request(app.getHttpServer())
			.post(`${adminBase}/${requestId}/approve`)
			.set("Authorization", auth(porterId, "admin"))
			.send(input)
			.expect(403);
		await db.query("UPDATE porter_profiles SET version=version+1 WHERE porter_id=$1", [porterId]);
		await request(app.getHttpServer())
			.post(`${adminBase}/${requestId}/approve`)
			.set("Authorization", auth(adminId, "admin"))
			.send(input)
			.expect(409);
	});
	it("rolls back rank, request, history and outbox together on an audit failure", async () => {
		await db.query(
			`CREATE FUNCTION porter_request_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='porter_level.reviewed' THEN RAISE EXCEPTION 'forced test rollback'; END IF; RETURN NEW; END $$`
		);
		await db.query(
			"CREATE TRIGGER porter_request_test_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION porter_request_test_fail()"
		);
		try {
			await request(app.getHttpServer())
				.post(`${adminBase}/${requestId}/approve`)
				.set("Authorization", auth(adminId, "admin"))
				.send(await approveInput())
				.expect(500);
		} finally {
			await db.query("DROP TRIGGER porter_request_test_fail ON audit_logs");
			await db.query("DROP FUNCTION porter_request_test_fail()");
		}
		expect((await detail()).request.status).toBe("pending");
		const rows = await db.query("SELECT id FROM porter_level_decisions WHERE request_id=$1", [
			requestId,
		]);
		expect(rows).toHaveLength(0);
	});
	it("lets only one Admin approve, records immutable snapshots and cannot change finished requests", async () => {
		const input = await approveInput();
		const approve = (actor: string) =>
			request(app.getHttpServer())
				.post(`${adminBase}/${requestId}/approve`)
				.set("Authorization", auth(actor, "admin"))
				.send(input);
		const results = await Promise.all([approve(adminId), approve(admin2Id)]);
		expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
		const d = await detail();
		expect(d.request.status).toBe("approved");
		const history = await request(app.getHttpServer())
			.get(`${levels}/qualifications/${qualificationId}/history`)
			.set("Authorization", auth(adminId, "admin"))
			.expect(200);
		expect(history.body).toHaveLength(1);
		expect(history.body[0]).toMatchObject({
			source: "request",
			requestId,
			action: "upgrade",
			fromLevel: "learning",
			toLevel: "expert",
			fromVerified: false,
			toVerified: true,
			comparisonSnapshot: null,
		});
		expect(history.body[0].evidenceSnapshot).toHaveLength(1);
		expect(history.body[0].evidenceSnapshot[0].fileName).toBe("retained.pdf");
		await db.query(
			"UPDATE porter_level_policies SET definition=jsonb_set(definition,'{name}','\"Changed\"'),version=version+1 WHERE level='expert'"
		);
		const stored = await request(app.getHttpServer())
			.get(`${levels}/qualifications/${qualificationId}/history`)
			.set("Authorization", auth(adminId, "admin"))
			.expect(200);
		expect(stored.body[0].policySnapshot.definition.name).toBe("Criteria expert");
		await request(app.getHttpServer())
			.post(`${base}/${requestId}/cancel`)
			.set("Authorization", auth())
			.send({ expectedVersion: d.request.version })
			.expect(409);
		await request(app.getHttpServer())
			.delete(`${base}/${requestId}/evidence/${d.evidence[1].id}`)
			.set("Authorization", auth())
			.send({ expectedVersion: d.request.version })
			.expect(409);
		await request(app.getHttpServer())
			.get(`${adminBase}/${requestId}/evidence/${d.evidence[0].id}`)
			.set("Authorization", auth(adminId, "admin"))
			.expect(200);
	});
	it("delivers transactional in-app notifications idempotently and keeps them private", async () => {
		await notifications.dispatch();
		await notifications.dispatch();
		const response = await request(app.getHttpServer())
			.get("/api/porter/level-notifications")
			.set("Authorization", auth())
			.expect(200);
		expect(response.body).toHaveLength(2);
		expect(
			response.body.map((item: { payload: { kind: string } }) => item.payload.kind).sort()
		).toEqual(["approved", "needs_info"]);
		const other = await request(app.getHttpServer())
			.get("/api/porter/level-notifications")
			.set("Authorization", auth(otherId))
			.expect(200);
		expect(other.body).toEqual([]);
	});
	it("allows direct downgrade after closure, blocks no-op, and supports cancel/reject from needs-info", async () => {
		const comparison = await request(app.getHttpServer())
			.get(`${levels}/qualifications/${qualificationId}/comparison/learning`)
			.set("Authorization", auth(adminId, "admin"))
			.expect(200);
		const body = {
			level: "learning",
			outcome: "approved",
			reason: "Admin reviewed a need for closer support",
			expectedQualificationVersion: comparison.body.qualification.version,
			expectedPolicyVersion: comparison.body.policy.version,
			expectedDossierHash: comparison.body.dossierHash,
		};
		await request(app.getHttpServer())
			.post(`${levels}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", auth(adminId, "admin"))
			.send(body)
			.expect(201);
		const q = await request(app.getHttpServer())
			.get(`${levels}/qualifications/${qualificationId}/comparison/learning`)
			.set("Authorization", auth(adminId, "admin"))
			.expect(200);
		await request(app.getHttpServer())
			.post(`${levels}/qualifications/${qualificationId}/decisions`)
			.set("Authorization", auth(adminId, "admin"))
			.send({ ...body, expectedQualificationVersion: q.body.qualification.version })
			.expect(409);
		for (const action of ["cancel", "reject"]) {
			const response = await request(app.getHttpServer())
				.post(base)
				.set("Authorization", auth())
				.field("routeId", routeId)
				.field("targetLevel", "expert")
				.field("reason", "New evidence")
				.field("expectedQualificationVersion", String(q.body.qualification.version))
				.expect(201);
			requestId = response.body.id;
			await request(app.getHttpServer())
				.post(`${adminBase}/${requestId}/request-info`)
				.set("Authorization", auth(adminId, "admin"))
				.send({ expectedVersion: 1, reason: "Please clarify" })
				.expect(201);
			await request(app.getHttpServer())
				.post(`${action === "cancel" ? base : adminBase}/${requestId}/${action}`)
				.set("Authorization", action === "cancel" ? auth() : auth(adminId, "admin"))
				.send({
					expectedVersion: 2,
					...(action === "reject" ? { reason: "Evidence insufficient" } : {}),
				})
				.expect(201);
		}
	});
});

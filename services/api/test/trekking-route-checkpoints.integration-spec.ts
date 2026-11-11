import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { hash } from "bcrypt";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { CheckpointType } from "../src/modules/trekking-routes/entities/checkpoint.entity";
import { TrekkingRouteStatus } from "../src/modules/trekking-routes/entities/trekking-route.entity";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("trekking route checkpoint update (integration, real Postgres)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	let userIds: string[] = [];
	let routeIds: string[] = [];

	beforeAll(async () => {
		jest.setTimeout(60000);
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
		await assertSafeTestDatabase(dataSource);
	}, 60000);

	afterAll(async () => {
		await app?.close();
	});

	beforeEach(() => {
		userIds = [];
		routeIds = [];
	});

	afterEach(async () => {
		if (routeIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "target_id" IN (SELECT "id" FROM "checkpoints" WHERE "route_id" = ANY($1))',
				[routeIds]
			);
			await dataSource.query('DELETE FROM "checkpoints" WHERE "route_id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
		}
		if (userIds.length > 0) {
			await dataSource.query(
				'DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1) OR "target_id" = ANY($1)',
				[userIds]
			);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "refresh_tokens" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "verification_otps" WHERE "user_id" = ANY($1)', [
				userIds,
			]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
	});

	async function createUser(
		role: UserRole = UserRole.HOST
	): Promise<{ id: string; token: string }> {
		const id = randomUUID();
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`
			INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			VALUES ($1, $2, $3, $4, $5, $6)
			`,
			[id, `checkpoint-${id}@example.com`, passwordHash, role, UserStatus.ACTIVE, "Checkpoint Host"]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, token: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createDraftRoute(hostId: string): Promise<string> {
		const routeId = randomUUID();
		await dataSource.query(
			`
			INSERT INTO "trekking_routes" (
				"id", "host_id", "name", "description", "route_geom", "length_meters",
				"difficulty", "expected_duration_minutes", "status"
			)
			VALUES (
				$1, $2, $3, $4,
				ST_SetSRID(ST_MakeLine(
					ST_MakePoint(108.2208, 16.0471),
					ST_MakePoint(108.2508, 16.0671)
				), 4326)::geography,
				3500, 'moderate', 240, $5
			)
			`,
			[
				routeId,
				hostId,
				`Checkpoint route ${routeId}`,
				"Integration route",
				TrekkingRouteStatus.DRAFT,
			]
		);
		routeIds.push(routeId);
		return routeId;
	}

	function checkpointPayload() {
		return {
			name: "Ridge rest",
			location: { type: "Point", coordinates: [108.2208, 16.0471] },
			radiusMeters: 20,
			type: CheckpointType.DANGEROUS,
			expectedArrivalOffset: 45,
			instructions: "Rest here.",
			nearbyWaterOrShelter: false,
		};
	}

	function routePayload() {
		return {
			name: "Updated ridge",
			description: "Updated draft",
			difficulty: "hard",
			geometry: {
				type: "LineString",
				coordinates: [
					[108.2208, 16.0471],
					[108.2508, 16.0671],
				],
			},
			expectedDurationMinutes: 180,
		};
	}

	it("paginates, searches and sorts Host routes with scoped status totals", async () => {
		const host = await createUser();
		const other = await createUser();
		for (let index = 1; index <= 8; index++) {
			const routeId = await createDraftRoute(host.id);
			await dataSource.query(
				"UPDATE trekking_routes SET name=$2, status=$3, created_at=$4 WHERE id=$1",
				[
					routeId,
					`Ridge ${index}`,
					index % 2 ? "draft" : "active",
					`2026-10-${String(index).padStart(2, "0")}T00:00:00Z`,
				]
			);
		}
		const foreignId = await createDraftRoute(other.id);
		await dataSource.query("UPDATE trekking_routes SET name=$2 WHERE id=$1", [
			foreignId,
			"Ridge 1 foreign",
		]);
		const list = (query: Record<string, string | number>) =>
			request(app.getHttpServer())
				.get("/api/trekking-routes/paginated")
				.set("Authorization", `Bearer ${host.token}`)
				.query(query)
				.expect(200);
		const first = await list({ limit: 6 });
		expect(first.body.pagination).toMatchObject({ page: 1, limit: 6, total: 8, totalPages: 2 });
		expect(first.body.statusCounts).toEqual({
			all: 8,
			draft: 4,
			pending_approval: 0,
			active: 4,
			closed: 0,
		});
		expect(first.body.items).toHaveLength(6);
		expect(first.body.items[0].name).toBe("Ridge 8");
		const second = await list({ page: 2, limit: 6 });
		expect(second.body.items.map((row: { name: string }) => row.name)).toEqual([
			"Ridge 2",
			"Ridge 1",
		]);
		const searched = await list({ search: "  ridge 1 ", limit: 6 });
		expect(searched.body.items.map((row: { name: string }) => row.name)).toEqual(["Ridge 1"]);
		expect(searched.body.statusCounts.all).toBe(1);
		const active = await list({ status: "active", sort: "name", limit: 6 });
		expect(active.body.items.map((row: { name: string }) => row.name)).toEqual([
			"Ridge 2",
			"Ridge 4",
			"Ridge 6",
			"Ridge 8",
		]);
		expect(active.body.pagination.total).toBe(4);
		expect(active.body.statusCounts.all).toBe(8);
		const literal = await list({ search: "%", limit: 6 });
		expect(literal.body.items).toEqual([]);
		expect(literal.body.pagination.total).toBe(0);
	});

	it("creates, edits and submits a route without creating any checkpoints", async () => {
		const host = await createUser();
		const created = await request(app.getHttpServer())
			.post("/api/trekking-routes")
			.set("Authorization", `Bearer ${host.token}`)
			.send(routePayload())
			.expect(201);
		const routeId: string = created.body.id;
		routeIds.push(routeId);
		const assertNoCheckpoints = async () => {
			const response = await request(app.getHttpServer())
				.get(`/api/trekking-routes/${routeId}/checkpoints`)
				.set("Authorization", `Bearer ${host.token}`)
				.expect(200);
			expect(response.body).toEqual([]);
		};
		await assertNoCheckpoints();
		const moved = {
			...routePayload(),
			expectedDurationMinutes: 90,
			geometry: {
				type: "LineString",
				coordinates: [
					[108.3, 16.1],
					[108.4, 16.2],
				],
			},
		};
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(moved)
			.expect(200)
			.expect(({ body }) => expect(body.geometry).toEqual(moved.geometry));
		await assertNoCheckpoints();
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/submit-for-approval`)
			.set("Authorization", `Bearer ${host.token}`)
			.expect(200)
			.expect(({ body }) => expect(body.status).toBe("pending_approval"));
		await assertNoCheckpoints();
		const admin = await createUser(UserRole.ADMIN);
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/review`)
			.set("Authorization", `Bearer ${admin.token}`)
			.send({ action: "approve" })
			.expect(200)
			.expect(({ body }) => expect(body.status).toBe("active"));
		await assertNoCheckpoints();
	});

	it("submits an existing draft without endpoint checkpoints", async () => {
		const host = await createUser();
		const routeId = await createDraftRoute(host.id);
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/submit-for-approval`)
			.set("Authorization", `Bearer ${host.token}`)
			.expect(200)
			.expect(({ body }) => expect(body.status).toBe("pending_approval"));
		const rows = await dataSource.query("SELECT id FROM checkpoints WHERE route_id=$1", [routeId]);
		expect(rows).toEqual([]);
	});

	it("updates route geometry and length while protecting ownership and status", async () => {
		const host = await createUser();
		const other = await createUser();
		const routeId = await createDraftRoute(host.id);
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}`)
			.set("Authorization", `Bearer ${other.token}`)
			.send(routePayload())
			.expect(403);
		await request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(checkpointPayload())
			.expect(201);
		const updated = await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(routePayload())
			.expect(200);
		expect(updated.body).toMatchObject({
			name: "Updated ridge",
			status: "draft",
			hostId: host.id,
			expectedDurationMinutes: 180,
		});
		expect(updated.body.lengthMeters).toBeGreaterThan(0);
		for (const status of ["pending_approval", "active", "closed"]) {
			await dataSource.query('UPDATE "trekking_routes" SET "status" = $2 WHERE "id" = $1', [
				routeId,
				status,
			]);
			await request(app.getHttpServer())
				.patch(`/api/trekking-routes/${routeId}`)
				.set("Authorization", `Bearer ${host.token}`)
				.send(routePayload())
				.expect(409);
		}
		await dataSource.query('UPDATE "trekking_routes" SET "status" = $2 WHERE "id" = $1', [
			routeId,
			"draft",
		]);
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}`)
			.set("Authorization", `Bearer ${host.token}`)
			.send({ ...routePayload(), name: "Revised draft" })
			.expect(200);
	});

	it("keeps legacy checkpoint data independent when route geometry and duration change", async () => {
		const host = await createUser();
		const routeId = await createDraftRoute(host.id);
		await request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.set("Authorization", `Bearer ${host.token}`)
			.send({ ...checkpointPayload(), radiusMeters: 30 })
			.expect(422);
		await request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(checkpointPayload())
			.expect(201);
		const legacyBefore = await dataSource.query('SELECT * FROM "checkpoints" WHERE "route_id"=$1', [
			routeId,
		]);
		for (const payload of [
			{ ...routePayload(), expectedDurationMinutes: 1 },
			{
				...routePayload(),
				geometry: {
					type: "LineString",
					coordinates: [
						[0, 0],
						[0.1, 0.1],
					],
				},
			},
		]) {
			await request(app.getHttpServer())
				.patch(`/api/trekking-routes/${routeId}`)
				.set("Authorization", `Bearer ${host.token}`)
				.send(payload)
				.expect(200);
		}
		const legacyAfter = await dataSource.query('SELECT * FROM "checkpoints" WHERE "route_id"=$1', [
			routeId,
		]);
		expect(legacyAfter).toEqual(legacyBefore);
		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/submit-for-approval`)
			.set("Authorization", `Bearer ${host.token}`)
			.expect(200);
	});

	it("keeps POST working and PATCHes every editable field with derived route position and audit", async () => {
		const host = await createUser();
		const routeId = await createDraftRoute(host.id);
		const created = await request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(checkpointPayload())
			.expect(201);

		const updatePayload = {
			name: "Điểm cấp nước",
			location: { type: "Point", coordinates: [108.2308, 16.0537667] },
			radiusMeters: 20,
			type: CheckpointType.WATER,
			expectedArrivalOffset: 80,
			instructions: "Bổ sung nước tại đây.",
			nearbyWaterOrShelter: true,
		};
		const updated = await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/checkpoints/${created.body.id}`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(updatePayload)
			.expect(200);

		expect(updated.body).toMatchObject({
			id: created.body.id,
			routeId,
			...updatePayload,
		});
		expect(updated.body.routePosition).toBeGreaterThan(created.body.routePosition);

		const audits = await dataSource.query(
			'SELECT "before", "after" FROM "audit_logs" WHERE "target_id" = $1 AND "action" = $2',
			[created.body.id, "trekking_route_checkpoint.updated"]
		);
		expect(audits).toHaveLength(1);
		expect(audits[0].before).toMatchObject({ name: "Ridge rest", type: CheckpointType.DANGEROUS });
		expect(audits[0].after).toMatchObject({
			name: "Điểm cấp nước",
			type: CheckpointType.WATER,
		});
	});

	it("rejects a moved point outside 50 meters and preserves the stored checkpoint", async () => {
		const host = await createUser();
		const routeId = await createDraftRoute(host.id);
		const created = await request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(checkpointPayload())
			.expect(201);

		await request(app.getHttpServer())
			.patch(`/api/trekking-routes/${routeId}/checkpoints/${created.body.id}`)
			.set("Authorization", `Bearer ${host.token}`)
			.send({
				...checkpointPayload(),
				name: "Must not persist",
				location: { type: "Point", coordinates: [0, 0] },
			})
			.expect(422);

		const rows = await dataSource.query('SELECT "name" FROM "checkpoints" WHERE "id" = $1', [
			created.body.id,
		]);
		expect(rows[0].name).toBe("Ridge rest");
	});
});

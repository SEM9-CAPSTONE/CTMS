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

	async function createHost(): Promise<{ id: string; token: string }> {
		const id = randomUUID();
		const passwordHash = await hash("S3curePass!", 10);
		await dataSource.query(
			`
			INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			VALUES ($1, $2, $3, $4, $5, $6)
			`,
			[
				id,
				`checkpoint-${id}@example.com`,
				passwordHash,
				UserRole.HOST,
				UserStatus.ACTIVE,
				"Checkpoint Host",
			]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			UserRole.HOST,
		]);
		userIds.push(id);
		return { id, token: jwtService.sign({ sub: id, roles: [UserRole.HOST] }) };
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
			radiusMeters: 30,
			type: CheckpointType.REST,
			expectedArrivalOffset: 45,
			instructions: "Rest here.",
			nearbyWaterOrShelter: false,
		};
	}

	it("keeps POST working and PATCHes every editable field with derived route position and audit", async () => {
		const host = await createHost();
		const routeId = await createDraftRoute(host.id);
		const created = await request(app.getHttpServer())
			.post(`/api/trekking-routes/${routeId}/checkpoints`)
			.set("Authorization", `Bearer ${host.token}`)
			.send(checkpointPayload())
			.expect(201);

		const updatePayload = {
			name: "Điểm cấp nước",
			location: { type: "Point", coordinates: [108.2308, 16.0537667] },
			radiusMeters: 45,
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
		expect(audits[0].before).toMatchObject({ name: "Ridge rest", type: CheckpointType.REST });
		expect(audits[0].after).toMatchObject({
			name: "Điểm cấp nước",
			type: CheckpointType.WATER,
		});
	});

	it("rejects a moved point outside 50 meters and preserves the stored checkpoint", async () => {
		const host = await createHost();
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

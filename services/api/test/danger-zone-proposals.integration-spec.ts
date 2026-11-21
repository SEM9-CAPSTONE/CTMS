import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { UserRole, UserStatus } from "../src/modules/users/entities/user.entity";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

interface Account {
	id: string;
	accessToken: string;
}

const BOUNDS = { west: 108.2, south: 16.0, east: 108.3, north: 16.1 };
const REJECT_REASON = "Đoàn kiểm tra lại tại chỗ, lối đi đã được dọn thông thoáng.";

describe("Danger-zone proposals and hotspot review (real Postgres/PostGIS)", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	let jwtService: JwtService;
	const userIds: string[] = [];
	const routeIds: string[] = [];
	const tripIds: string[] = [];
	let admin: Account;
	let host: Account;
	let otherHost: Account;
	let camper: Account;

	beforeAll(async () => {
		process.env.OFFLINE_PACKAGE_WORKER_ENABLED = "false";
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
		admin = await createAccount(UserRole.ADMIN, "Trần Minh Quân");
		host = await createAccount(UserRole.HOST, "Lê Thu Hà");
		otherHost = await createAccount(UserRole.HOST, "Đỗ Văn Khoa");
		camper = await createAccount(UserRole.CAMPER, "Phạm Gia Bảo");
	}, 60_000);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.query('DELETE FROM "danger_zone_proposals" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query('DELETE FROM "audit_logs" WHERE "actor_id" = ANY($1)', [userIds]);
			await dataSource.query(
				'DELETE FROM "incident_actions" WHERE "incident_id" IN (SELECT "id" FROM "trip_incidents" WHERE "trip_id" = ANY($1))',
				[tripIds]
			);
			await dataSource.query('DELETE FROM "trip_incidents" WHERE "trip_id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "potential_safety_hotspots" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query('DELETE FROM "offline_package_jobs" WHERE "trip_id" = ANY($1)', [
				tripIds,
			]);
			await dataSource.query('DELETE FROM "trips" WHERE "id" = ANY($1)', [tripIds]);
			await dataSource.query('DELETE FROM "route_danger_zones" WHERE "route_id" = ANY($1)', [
				routeIds,
			]);
			await dataSource.query('DELETE FROM "trekking_routes" WHERE "id" = ANY($1)', [routeIds]);
			await dataSource.query('DELETE FROM "user_roles" WHERE "user_id" = ANY($1)', [userIds]);
			await dataSource.query('DELETE FROM "users" WHERE "id" = ANY($1)', [userIds]);
		}
		await app?.close();
	});

	async function createAccount(role: UserRole, fullName: string): Promise<Account> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "users" ("id", "email", "password_hash", "role", "status", "full_name")
			 VALUES ($1, $2, 'unused-test-hash', $3, $4, $5)`,
			[id, `proposal-${role}-${id}@example.com`, role, UserStatus.ACTIVE, fullName]
		);
		await dataSource.query('INSERT INTO "user_roles" ("user_id", "role") VALUES ($1, $2)', [
			id,
			role,
		]);
		userIds.push(id);
		return { id, accessToken: jwtService.sign({ sub: id, roles: [role] }) };
	}

	async function createRoute(status = "active"): Promise<string> {
		const routeId = randomUUID();
		await dataSource.query(
			`INSERT INTO "trekking_routes" ("id", "host_id", "name", "route_geom", "length_meters", "difficulty", "expected_duration_minutes", "status")
			 VALUES ($1, $2, 'Khám phá bán đảo Sơn Trà',
			   ST_SetSRID(ST_MakeLine(ST_MakePoint(108.22, 16.06), ST_MakePoint(108.26, 16.06)), 4326)::geography,
			   4300, 'moderate', 240, $3)`,
			[routeId, host.id, status]
		);
		routeIds.push(routeId);
		return routeId;
	}

	async function createOngoingTrip(routeId: string): Promise<string> {
		const tripId = randomUUID();
		const startsAt = new Date(Date.now() - 60 * 60 * 1000);
		await dataSource.query(
			`INSERT INTO "trips" ("id", "host_id", "route_id", "title", "trip_type", "duration_nights",
			   "starts_at", "ends_at", "meeting_point", "booking_deadline", "capacity_min", "capacity_max",
			   "seats_taken", "price_per_person", "status")
			 VALUES ($1, $2, $3, 'Sơn Trà bình minh', 'day_trip', 0, $4, $4::timestamptz + interval '8 hours',
			   ST_GeogFromText('SRID=4326;POINT(108.22 16.06)'), $4::timestamptz - interval '2 hours', 1, 20, 1, 500000, 'ongoing')`,
			[tripId, host.id, routeId, startsAt]
		);
		tripIds.push(tripId);
		return tripId;
	}

	const api = () => request(app.getHttpServer());
	const as = (account: Account, call: request.Test) =>
		call.set("Authorization", `Bearer ${account.accessToken}`);
	const propose = (account: Account, routeId: string, body: Record<string, unknown>) =>
		as(account, api().post(`/api/trekking-routes/${routeId}/danger-zone-proposals`)).send(body);
	const pointProposal = {
		hazardType: "SLIPPERY_OR_LANDSLIDE",
		geometry: { type: "Point", coordinates: [108.24, 16.061] },
		radiusMeters: 40,
		severity: "high",
		description: "Đoạn dốc đất đỏ sau mưa rất trơn, đã có người trượt ngã.",
	};
	const publishedIds = async (account: Account) => {
		const response = await as(account, api().get("/api/route-safety/verified-zones"))
			.query(BOUNDS)
			.expect(200);
		return (response.body.features as Array<{ id: string }>).map((feature) => feature.id);
	};

	it("lets the owning Host propose on a Route in any status without publishing it", async () => {
		const routeId = await createRoute("active");
		await propose(otherHost, routeId, pointProposal).expect(403);
		await propose(camper, routeId, pointProposal).expect(403);
		const created = await propose(host, routeId, pointProposal).expect(201);
		expect(created.body).toMatchObject({
			source: "HOST",
			status: "PENDING",
			hazardType: "SLIPPERY_OR_LANDSLIDE",
			radiusMeters: 40,
			routeName: "Khám phá bán đảo Sơn Trà",
			proposerName: "Lê Thu Hà",
			dangerZoneId: null,
		});
		const [{ count }] = await dataSource.query(
			`SELECT count(*)::int AS count FROM "route_danger_zones" WHERE "route_id" = $1`,
			[routeId]
		);
		expect(count).toBe(0);

		const list = await as(
			host,
			api().get(`/api/trekking-routes/${routeId}/danger-zone-proposals`)
		).expect(200);
		expect(list.body.map((row: { id: string }) => row.id)).toEqual([created.body.id]);
	});

	it("publishes an approved proposal to every role and keeps a rejected one private", async () => {
		const routeId = await createRoute("closed");
		const approved = await propose(host, routeId, pointProposal).expect(201);
		const rejected = await propose(host, routeId, {
			...pointProposal,
			geometry: { type: "Point", coordinates: [108.25, 16.062] },
		}).expect(201);

		await as(host, api().post(`/api/admin/danger-zone-proposals/${approved.body.id}/approve`))
			.send({ severity: "high", description: "Dốc đất trơn trượt khi mưa" })
			.expect(403);
		const decision = await as(
			admin,
			api().post(`/api/admin/danger-zone-proposals/${approved.body.id}/approve`)
		)
			.send({ severity: "medium", description: "Dốc đất trơn trượt khi mưa", radiusMeters: 60 })
			.expect(200);
		expect(decision.body).toMatchObject({
			status: "APPROVED",
			reviewerName: "Trần Minh Quân",
		});
		await as(admin, api().post(`/api/admin/danger-zone-proposals/${approved.body.id}/approve`))
			.send({ severity: "medium", description: "Dốc đất trơn trượt khi mưa" })
			.expect(409);

		await as(admin, api().post(`/api/admin/danger-zone-proposals/${rejected.body.id}/reject`))
			.send({ reason: "ngắn" })
			.expect(422);
		await as(admin, api().post(`/api/admin/danger-zone-proposals/${rejected.body.id}/reject`))
			.send({ reason: REJECT_REASON })
			.expect(200);

		const zoneId = decision.body.dangerZoneId as string;
		for (const account of [camper, otherHost, admin]) {
			const ids = await publishedIds(account);
			expect(ids).toContain(`host:${zoneId}`);
			expect(ids).toHaveLength(new Set(ids).size);
		}
		const [zone] = await dataSource.query(
			`SELECT "radius_m" AS "radius", "severity", "description" FROM "route_danger_zones" WHERE "id" = $1`,
			[zoneId]
		);
		expect(zone).toEqual({
			radius: 60,
			severity: "medium",
			description: "Dốc đất trơn trượt khi mưa",
		});

		// An edit nobody approved withdraws the zone from the shared layer.
		await dataSource.query(
			`UPDATE "route_danger_zones" SET "description" = 'Sửa tay chưa duyệt' WHERE "id" = $1`,
			[zoneId]
		);
		expect(await publishedIds(camper)).not.toContain(`host:${zoneId}`);
	});

	it("queues an eligible field incident with a fresh position, and nothing else", async () => {
		const routeId = await createRoute();
		const tripId = await createOngoingTrip(routeId);
		const now = new Date().toISOString();
		const report = (category: string, location: Record<string, unknown> | null) =>
			as(host, api().post(`/api/trips/${tripId}/incidents`)).send({
				id: randomUUID(),
				category,
				severity: "critical",
				description: "Mất liên lạc với một thành viên gần ngã ba suối Đá.",
				occurredAt: now,
				location,
			});
		const fresh = { latitude: 16.0605, longitude: 108.241, accuracyMeters: 12, capturedAt: now };

		const lost = await report("lost_member", fresh).expect(200);
		await report("injury", fresh).expect(200);
		await report("damaged_barrier", null).expect(200);
		await report("damaged_barrier", {
			...fresh,
			capturedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
		}).expect(200);

		const proposals = await dataSource.query(
			`SELECT "incident_id" AS "incidentId", "hazard_type" AS "hazardType", "severity", "radius_m" AS "radius",
			   "status", ST_X("geom"::geometry) AS "lng"
			 FROM "danger_zone_proposals" WHERE "route_id" = $1`,
			[routeId]
		);
		expect(proposals).toEqual([
			{
				incidentId: lost.body.incident.id,
				hazardType: "LOST_MEMBER",
				severity: "high",
				radius: 30,
				status: "PENDING",
				lng: 108.241,
			},
		]);
		const adminList = await as(admin, api().get("/api/admin/danger-zone-proposals"))
			.query({ status: "PENDING" })
			.expect(200);
		const row = adminList.body.find(
			(item: { incidentId?: string; tripTitle: string | null; source: string }) =>
				item.source === "INCIDENT" && item.tripTitle === "Sơn Trà bình minh"
		);
		expect(row).toBeDefined();
	});

	it("moves a hotspot through review only in lifecycle order with a reason", async () => {
		const routeId = await createRoute();
		const [{ id: hotspotId }] = (await dataSource.query(
			`INSERT INTO "potential_safety_hotspots"
			   ("route_id", "route_version", "status", "status_changed_at", "analysis_version", "config_version",
			    "criteria", "window_start", "window_end", "center", "radius_meters", "anchor_event_id",
			    "route_fraction_min", "route_fraction_max", "event_count", "distinct_trip_count",
			    "distinct_member_count", "evidence_event_ids", "evidence_hash", "first_event_at", "last_event_at",
			    "detected_at")
			 VALUES ($1, 'route-md5-a', 'DETECTED', now(), 'v1-anchor-cluster', 'v3', '{}'::jsonb,
			   now() - interval '30 days', now(), ST_SetSRID(ST_MakePoint(108.24, 16.06), 4326)::geography, 50,
			   $2, 0.4, 0.6, 5, 3, 3, $3::uuid[], $4, now() - interval '10 days', now() - interval '2 days', now())
			 RETURNING "id"`,
			[
				routeId,
				randomUUID(),
				[randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()],
				randomUUID().replace(/-/g, "").padEnd(64, "0"),
			]
		)) as Array<{ id: string }>;
		const review = (
			account: Account,
			status: string,
			reason = "Nhiều đoàn lệch tuyến tại cùng một ngã ba."
		) =>
			as(account, api().post(`/api/admin/safety-hotspots/${hotspotId}/review`)).send({
				status,
				reason,
			});

		await review(host, "UNDER_REVIEW").expect(403);
		expect((await review(admin, "CONFIRMED").expect(409)).body.code).toBe("INVALID_TRANSITION");
		await review(admin, "UNDER_REVIEW", "ngắn").expect(422);
		await review(admin, "UNDER_REVIEW").expect(200);
		const confirmed = await review(admin, "CONFIRMED").expect(200);
		expect(confirmed.body.status).toBe("CONFIRMED");
		await review(admin, "DISMISSED").expect(409);

		const history = await as(
			admin,
			api().get(`/api/admin/safety-hotspots/${hotspotId}/reviews`)
		).expect(200);
		expect(
			history.body.map((row: { fromStatus: string; toStatus: string; actorName: string }) => [
				row.fromStatus,
				row.toStatus,
				row.actorName,
			])
		).toEqual([
			["UNDER_REVIEW", "CONFIRMED", "Trần Minh Quân"],
			["DETECTED", "UNDER_REVIEW", "Trần Minh Quân"],
		]);
	});
});

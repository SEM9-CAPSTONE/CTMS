import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import { HostOverviewRepository } from "../src/modules/host-overview/host-overview.repository";
import type { HostOverview } from "../src/modules/host-overview/host-overview.types";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-377 Host overview (PostgreSQL + HTTP)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	let repository: HostOverviewRepository;
	const host = randomUUID();
	const other = randomUUID();
	const camper = randomUUID();
	const porter = randomUUID();
	const users = [host, other, camper, porter];
	const route = randomUUID();
	const unusedRoute = randomUUID();
	const foreignRoute = randomUUID();
	const routes = [route, unusedRoute, foreignRoute];
	const ongoing = randomUUID();
	const published = randomUUID();
	const foreignTrip = randomUUID();
	const trips = [ongoing, published, foreignTrip];
	const snapshot = randomUUID();
	const rule = randomUUID();
	const assessment = randomUUID();
	const endpoint = "/api/host/monitoring/overview";
	const bearer = (id = host, role = "host") => `Bearer ${jwt.sign({ sub: id, roles: [role] })}`;

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();
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
		repository = module.get(HostOverviewRepository);
		await assertSafeTestDatabase(db);
		for (const [id, role] of [
			[host, "host"],
			[other, "host"],
			[camper, "camper"],
			[porter, "porter"],
		]) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status) VALUES($1,$2,'unused',$3,'active')",
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
		for (const [id, owner] of [
			[route, host],
			[unusedRoute, host],
			[foreignRoute, other],
		]) {
			await db.query(
				`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			 VALUES($1,$2,'Overview Route',ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'),2500,'moderate',180,'active')`,
				[id, owner]
			);
		}
		for (const [id, owner, routeId, status] of [
			[ongoing, host, route, "ongoing"],
			[published, host, route, "published"],
			[foreignTrip, other, foreignRoute, "ongoing"],
		]) {
			await db.query(
				`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status)
			 VALUES($1,$2,$3,'Overview Trip','day_trip',0,now()+interval '1 day',now()+interval '2 days',ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'),now()+interval '1 hour',1,20,0,$4)`,
				[id, owner, routeId, status]
			);
			await db.query(
				"INSERT INTO bookings(trip_id,user_id,num_people,status,payment_status) VALUES($1,$2,2,'confirmed','not_required')",
				[id, camper]
			);
			await db.query(
				"INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned')",
				[id, porter]
			);
			for (const sosStatus of ["active", "acknowledged", "closed", "cancelled"]) {
				await db.query(
					`INSERT INTO sos_alerts(trip_id,sender_id,emergency_type,event_time,status,received_at)
				 VALUES($1,$2,'medical',now(),$3,now())`,
					[id, camper, sosStatus]
				);
			}
		}
	}, 60000);

	afterAll(async () => {
		if (db?.isInitialized) {
			await db.query("DELETE FROM sos_alerts WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM bookings WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM trip_porters WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM weather_risk_assessments WHERE route_id=ANY($1)", [routes]);
			await db.query("DELETE FROM weather_snapshots WHERE route_id=ANY($1)", [routes]);
			await db.query("DELETE FROM weather_risk_rules WHERE id=$1", [rule]);
			await db.query("DELETE FROM trips WHERE id=ANY($1)", [trips]);
			await db.query("DELETE FROM trekking_routes WHERE id=ANY($1)", [routes]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [users]);
		}
		await app?.close();
	});

	async function overview(query = ""): Promise<HostOverview> {
		const response = await request(app.getHttpServer())
			.get(endpoint + query)
			.set("Authorization", bearer())
			.expect(200);
		expect(response.headers["cache-control"]).toBe("private, no-store");
		return response.body as HostOverview;
	}

	it("requires active Host, including when JWT claims spoof a Host role", async () => {
		await request(app.getHttpServer()).get(endpoint).expect(401);
		await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", bearer(camper))
			.expect(403);
		await db.query("UPDATE users SET status='suspended' WHERE id=$1", [host]);
		try {
			await request(app.getHttpServer()).get(endpoint).set("Authorization", bearer()).expect(401);
		} finally {
			await db.query("UPDATE users SET status='active' WHERE id=$1", [host]);
		}
	});
	it("scopes every source to the caller, counts distinct Porters and includes unresolved SOS on all owned Trips", async () => {
		const result = await overview();
		expect(result.kpis).toEqual({
			todaysBookings: 2,
			activeTrips: 1,
			routes: 2,
			assignedPorters: 1,
			unresolvedSos: 4,
		});
		expect(result.activeTrips.data?.items.map((item) => item.id)).toEqual([ongoing]);
		expect(result.porters.data?.items[0].assignments).toHaveLength(2);
		expect(result.weather.data?.total).toBe(1);
		expect(result.weather.data?.items[0]).toMatchObject({
			routeId: route,
			state: "unavailable",
			riskLevel: null,
		});
		for (const id of [foreignTrip, foreignRoute, other])
			expect(JSON.stringify(result)).not.toContain(id);
	});
	it("bounds pagination without changing full totals and rejects client-supplied scope", async () => {
		const result = await overview("?page=2&limit=1");
		expect(result.bookings.data?.items).toHaveLength(1);
		expect(result.kpis.todaysBookings).toBe(2);
		expect(result.porters.data?.items).toEqual([]);
		for (const query of ["?limit=101", "?page=0", "?page=1.5", `?hostId=${other}`]) {
			await request(app.getHttpServer())
				.get(endpoint + query)
				.set("Authorization", bearer())
				.expect(422);
		}
	});
	it("uses half-open local-day bounds at UTC+7 midnight, independent of database timezone", async () => {
		const ids = [randomUUID(), randomUUID(), randomUUID()];
		try {
			for (const [index, time] of [
				"2020-01-01T16:59:59Z",
				"2020-01-01T17:00:00Z",
				"2020-01-02T17:00:00Z",
			].entries()) {
				await db.query("INSERT INTO bookings(id,trip_id,user_id,created_at) VALUES($1,$2,$3,$4)", [
					ids[index],
					ongoing,
					camper,
					time,
				]);
			}
			const result = await repository.bookings(
				host,
				"2020-01-02T01:00:00Z",
				"Asia/Ho_Chi_Minh",
				1,
				20
			);
			expect(result.total).toBe(1);
			expect(result.items[0].id).toBe(ids[1]);
		} finally {
			await db.query("DELETE FROM bookings WHERE id=ANY($1)", [ids]);
		}
	});
	it("returns valid empty sources for a Host without operations", async () => {
		const emptyHost = randomUUID();
		await db.query(
			"INSERT INTO users(id,password_hash,role,status) VALUES($1,'unused','host','active')",
			[emptyHost]
		);
		try {
			const result = await repository.bookings(
				emptyHost,
				new Date().toISOString(),
				"Asia/Ho_Chi_Minh",
				1,
				20
			);
			expect(result).toEqual({ total: 0, items: [] });
		} finally {
			await db.query("DELETE FROM users WHERE id=$1", [emptyHost]);
		}
	});
	it("preserves successful sections and nulls a failed KPI, without exposing internal errors", async () => {
		const failure = jest.spyOn(repository, "sos").mockRejectedValueOnce(new Error("private SQL"));
		try {
			const result = await overview();
			expect(result.sos).toMatchObject({ availability: "unavailable", data: null });
			expect(result.kpis.unresolvedSos).toBeNull();
			expect(result.kpis.todaysBookings).toBe(2);
			expect(JSON.stringify(result)).not.toContain("private SQL");
		} finally {
			failure.mockRestore();
		}
	});

	it("does not mutate source records or add business audit events when reading the dashboard", async () => {
		const state = () =>
			db.query(
				`SELECT jsonb_build_object(
		 'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bookings b WHERE b.trip_id=ANY($1)),
		 'trips',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM trips t WHERE t.id=ANY($1)),
		 'porters',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.trip_id,p.porter_id) FROM trip_porters p WHERE p.trip_id=ANY($1)),
		 'sos',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM sos_alerts s WHERE s.trip_id=ANY($1)),
		 'audit',(SELECT count(*) FROM audit_logs WHERE actor_id=$2)) AS state`,
				[trips, host]
			);
		const before = await state();
		await overview();
		expect(await state()).toEqual(before);
	});
	it("reads latest route risk once, keeps its evidence and marks superseded/old/failed-provider risk stale", async () => {
		await db.query(
			`INSERT INTO weather_risk_rules(id,rainfall_yellow_threshold,rainfall_red_threshold,wind_yellow_threshold,wind_red_threshold,
		 temp_low_yellow,temp_low_red,temp_high_yellow,temp_high_red,visibility_yellow_threshold,visibility_red_threshold,
		 thunderstorm_yellow,thunderstorm_red,rainfall_weight,wind_weight,temperature_weight,visibility_weight,thunderstorm_weight,green_max_score,yellow_max_score,is_active)
		 VALUES($1,10,50,40,70,5,0,38,42,5000,1000,true,true,0.30,0.25,0.15,0.15,0.15,0.5,1.2,true)`,
			[rule]
		);
		await db.query(
			"INSERT INTO weather_snapshots(id,route_id,status,observed_at) VALUES($1,$2,'success',now())",
			[snapshot, route]
		);
		await db.query(
			`INSERT INTO weather_risk_assessments(id,route_id,snapshot_id,rule_version_id,risk_level,composite_score,criteria_scores,created_by)
		 VALUES($1,$2,$3,$4,'red',2,'{}',$5)`,
			[assessment, route, snapshot, rule, host]
		);
		let result = await overview();
		expect(result.weather.data?.items[0]).toMatchObject({
			state: "available",
			riskLevel: "red",
			assessmentId: assessment,
		});
		await db.query(
			"UPDATE weather_snapshots SET observed_at=now()-interval '2 hours' WHERE id=$1",
			[snapshot]
		);
		result = await overview();
		expect(result.weather.data?.items[0]).toMatchObject({ state: "stale", riskLevel: "red" });
		await db.query("UPDATE weather_snapshots SET observed_at=now() WHERE id=$1", [snapshot]);
		await db.query("UPDATE weather_risk_rules SET is_active=false WHERE id=$1", [rule]);
		expect((await overview()).weather.data?.items[0].state).toBe("stale");
		await db.query("UPDATE weather_risk_rules SET is_active=true WHERE id=$1", [rule]);
		await db.query(
			"INSERT INTO weather_snapshots(route_id,status,error_message) VALUES($1,'failed','Provider unavailable')",
			[route]
		);
		expect((await overview()).weather.data?.items[0]).toMatchObject({
			state: "stale",
			riskLevel: "red",
		});
	});
});

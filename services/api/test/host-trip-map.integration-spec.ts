import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import type { HostTripMap } from "../src/modules/host-trip-map/host-trip-map.types";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

describe("CTMS-369 Host Trip map (PostgreSQL + HTTP)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;
	const host = randomUUID();
	const other = randomUUID();
	const camper = randomUUID();
	const porter = randomUUID();
	const excluded = randomUUID();
	const users = [host, other, camper, porter, excluded];
	const route = randomUUID();
	const checkpoint = randomUUID();
	const ongoing = randomUUID();
	const published = randomUUID();
	const foreign = randomUUID();
	const trips = [ongoing, published, foreign];
	const booking = randomUUID();
	const cancelledBooking = randomUUID();
	const joined = randomUUID();
	const guest = randomUUID();
	const left = randomUUID();
	const removed = randomUUID();
	const registered = randomUUID();
	const cancelledMember = randomUUID();
	const latestGps = randomUUID();
	const endpoint = "/api/host/monitoring/active-trips";
	const bearer = (id = host) => `Bearer ${jwt.sign({ sub: id, roles: ["host"] })}`;
	const detail = (tripId = ongoing, id = joined, role = "camper") =>
		`${endpoint}/${tripId}/participants/${role}/${id}`;
	const map = async (query = ""): Promise<HostTripMap> => {
		const response = await request(app.getHttpServer())
			.get(endpoint + query)
			.set("Authorization", bearer())
			.expect(200);
		return response.body as HostTripMap;
	};

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
		await assertSafeTestDatabase(db);
		for (const [id, role] of [
			[host, "host"],
			[other, "host"],
			[camper, "camper"],
			[porter, "porter"],
			[excluded, "camper"],
		]) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,'unused',$3,'active','Map participant')",
				[id, `${id}@example.test`, role]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
		await db.query(
			`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Map Route',ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'),2500,'moderate',180,'active')`,
			[route, host]
		);
		await db.query(
			`INSERT INTO checkpoints(id,route_id,name,location,radius_m,type,expected_arrival_offset,instructions,nearby_water_or_shelter,route_position)
		 VALUES($1,$2,'Map checkpoint',ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'),30,'start',0,'Follow path',false,0)`,
			[checkpoint, route]
		);
		for (const [id, owner, status] of [
			[ongoing, host, "ongoing"],
			[published, host, "published"],
			[foreign, other, "ongoing"],
		]) {
			await db.query(
				`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status)
			 VALUES($1,$2,$3,'Map Trip','day_trip',0,now()-interval '1 hour',now()+interval '2 hours',ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'),now()-interval '2 hours',1,20,0,$4)`,
				[id, owner, route, status]
			);
		}
		for (const [id, status] of [
			[booking, "confirmed"],
			[cancelledBooking, "cancelled"],
		]) {
			await db.query(
				"INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status) VALUES($1,$2,$3,5,$4,'not_required')",
				[id, ongoing, camper, status]
			);
		}
		for (const [id, userId, status, bookingId] of [
			[joined, camper, "joined", booking],
			[guest, null, "joined", booking],
			[left, porter, "left", booking],
			[removed, excluded, "removed", booking],
			[registered, null, "registered", booking],
			[cancelledMember, excluded, "joined", cancelledBooking],
		]) {
			await db.query(
				"INSERT INTO booking_members(id,booking_id,user_id,member_status) VALUES($1,$2,$3,$4)",
				[id, bookingId, userId, status]
			);
		}
		await db.query(
			"INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned'),($1,$3,'unassigned')",
			[ongoing, porter, excluded]
		);
		// Old captures arrive after the newer capture, including one from another Trip.
		for (const [id, tripId, userId, role, age, receivedAge] of [
			[latestGps, ongoing, camper, "camper", 10, 5],
			[randomUUID(), ongoing, camper, "camper", 600, 0],
			[randomUUID(), foreign, camper, "camper", 1, 0],
			[randomUUID(), ongoing, porter, "porter", 600, 0],
		]) {
			await db.query(
				`INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,accuracy_meters,config_version,received_at)
			 VALUES($1,$2,$3,$4,now()-$5::int*interval '1 second',ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'),5,'v3',now()-$6::int*interval '1 second')`,
				[id, tripId, userId, role, age, receivedAge]
			);
		}
		for (const [type, age, receivedAge] of [
			["OFF_ROUTE", 600, 0],
			["ON_ROUTE_RECOVERED", 20, 10],
			["GPS_DEGRADED", 30, 10],
		]) {
			await db.query(
				`INSERT INTO safety_events(id,trip_id,user_id,participant_role,event_type,event_time,route_id,route_version,config_version,received_at,
			 location,accuracy_meters,distance_to_route_meters,consecutive_valid_samples,no_valid_sample_since)
			 VALUES($1,$2,$3,'camper',$4::safety_event_type,now()-$5::int*interval '1 second',$6,'test-route','v3',now()-$7::int*interval '1 second',
			 ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'),5,CASE WHEN $4::safety_event_type='OFF_ROUTE' THEN 60 ELSE 5 END,3,now()-($5::int+120)*interval '1 second')`,
				[randomUUID(), ongoing, camper, type, age, route, receivedAge]
			);
		}
		await db.query(
			"INSERT INTO checkpoint_visits(trip_id,checkpoint_id,member_id,confirmed_by_id,arrived_at) VALUES($1,$2,$3,$4,now()-interval '1 minute')",
			[ongoing, checkpoint, joined, porter]
		);
	}, 60000);

	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM safety_events WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM gps_logs WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM checkpoint_visits WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM bookings WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM trip_porters WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM trips WHERE id=ANY($1)", [trips]);
			await db.query("DELETE FROM checkpoints WHERE route_id=$1", [route]);
			await db.query("DELETE FROM trekking_routes WHERE id=$1", [route]);
			await db.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [users]);
			await db.query("DELETE FROM users WHERE id=ANY($1)", [users]);
		}
		await app?.close();
	});

	it("requires authentication and server-granted Host role, ignoring forged role claims", async () => {
		await request(app.getHttpServer()).get(endpoint).expect(401);
		await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", bearer(camper))
			.expect(403);
		await request(app.getHttpServer())
			.get(detail())
			.set("Authorization", bearer(porter))
			.expect(403);
	});
	it("loads only the Host's ongoing Trips with Route, ordered checkpoints and permitted participants", async () => {
		const result = await map();
		expect(result.total).toBe(1);
		expect(result.items.map((t) => t.id)).toEqual([ongoing]);
		expect(result.items[0].route).toMatchObject({
			id: route,
			geometry: { type: "LineString" },
			checkpoints: [{ id: checkpoint, location: { type: "Point", coordinates: [108.45, 11.94] } }],
		});
		expect(result.items[0].participants.map((p) => p.id).sort()).toEqual(
			[joined, guest, left, porter].sort()
		);
		expect(JSON.stringify(result)).not.toMatch(/password_hash|@example.test|health|phone/);
	});
	it("uses latest capture within Trip and participant role, retains stale and unavailable states", async () => {
		const participants = (await map()).items[0].participants;
		const member = participants.find((p) => p.id === joined);
		expect(member).toMatchObject({
			freshness: "fresh",
			location: { id: latestGps, latitude: 11.94, longitude: 108.45 },
		});
		expect(member?.lastSeenAt).toBe(member?.location?.eventTime);
		expect(participants.find((p) => p.id === porter)).toMatchObject({
			freshness: "stale",
			role: "porter",
		});
		expect(participants.find((p) => p.id === left)).toMatchObject({
			freshness: "unavailable",
			location: null,
		});
		expect(participants.find((p) => p.id === guest)).toMatchObject({
			userId: null,
			freshness: "unavailable",
			location: null,
			lastSeenAt: null,
		});
	});
	it("resolves latest safety transitions independently and exposes synchronized checkpoint context", async () => {
		const member = (await map()).items[0].participants.find((p) => p.id === joined);
		expect(member?.safety).toMatchObject({
			route: { type: "ON_ROUTE_RECOVERED" },
			gps: { type: "GPS_DEGRADED" },
			lastCheckpoint: { checkpointId: checkpoint },
			behindSchedule: null,
		});
	});
	it("provides authorized details and private no-store headers", async () => {
		const response = await request(app.getHttpServer())
			.get(detail())
			.set("Authorization", bearer())
			.expect(200);
		expect(response.headers["cache-control"]).toBe("private, no-store");
		expect(response.body).toMatchObject({
			tripId: ongoing,
			locationSource: "server_confirmed",
			participant: { id: joined, location: { id: latestGps } },
		});
		const list = await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", bearer())
			.expect(200);
		expect(list.headers["cache-control"]).toBe("private, no-store");
	});
	it("hides foreign, inactive and unrelated member details with the same 404", async () => {
		for (const url of [
			detail(foreign),
			detail(published),
			detail(ongoing, removed),
			detail(ongoing, randomUUID()),
			detail(ongoing, joined, "porter"),
		]) {
			await request(app.getHttpServer()).get(url).set("Authorization", bearer()).expect(404);
		}
		await request(app.getHttpServer())
			.get(detail())
			.set("Authorization", bearer(other))
			.expect(404);
	});
	it("keeps total when page is empty and accepts zero authorized Trips", async () => {
		expect(await map("?page=2&limit=1")).toMatchObject({ total: 1, items: [], page: 2, limit: 1 });
		const emptyHost = randomUUID();
		users.push(emptyHost);
		await db.query(
			"INSERT INTO users(id,password_hash,role,status) VALUES($1,'unused','host','active')",
			[emptyHost]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'host')", [emptyHost]);
		const response = await request(app.getHttpServer())
			.get(endpoint)
			.set("Authorization", bearer(emptyHost))
			.expect(200);
		expect(response.body).toMatchObject({ total: 0, items: [] });
	});
	it("validates query bounds, UUIDs and participant roles", async () => {
		for (const query of ["?page=0", "?limit=101", "?limit=1.5", "?hostId=anything"]) {
			await request(app.getHttpServer())
				.get(endpoint + query)
				.set("Authorization", bearer())
				.expect(422);
		}
		await request(app.getHttpServer())
			.get(detail("invalid"))
			.set("Authorization", bearer())
			.expect(422);
		await request(app.getHttpServer())
			.get(detail(ongoing, joined, "admin"))
			.set("Authorization", bearer())
			.expect(422);
	});
	it("does not mutate Route, Trip or source records while monitoring", async () => {
		const snapshot = () =>
			db.query(
				`SELECT jsonb_build_object(
		 'trips',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM trips t WHERE id=ANY($1)),
		 'route',(SELECT to_jsonb(r) FROM trekking_routes r WHERE id=$2),
		 'gps',(SELECT jsonb_agg(to_jsonb(g) ORDER BY id) FROM gps_logs g WHERE trip_id=ANY($1)),
		 'safety',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM safety_events s WHERE trip_id=ANY($1))) AS snapshot`,
				[trips, route]
			);
		const before = await snapshot();
		await map();
		await request(app.getHttpServer()).get(detail()).set("Authorization", bearer()).expect(200);
		expect(await snapshot()).toEqual(before);
	});
});

import { randomUUID } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/modules/app.module";
import type { TripMemberLocations } from "../src/modules/member-locations/member-locations.types";
import { validationExceptionFactory } from "../src/shared/pipes/validation-exception-factory";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

/** CTMS-066 (Jira CTMS-329): `GET /api/trips/:tripId/member-locations` against PostgreSQL + PostGIS. */
describe("CTMS-066 member last synced locations (PostgreSQL + HTTP)", () => {
	let app: INestApplication;
	let db: DataSource;
	let jwt: JwtService;

	const host = randomUUID();
	const otherHost = randomUUID();
	const porter = randomUUID();
	const unassignedPorter = randomUUID();
	const synced = randomUUID();
	const neverSynced = randomUUID();
	const cancelled = randomUUID();
	const users = [host, otherHost, porter, unassignedPorter, synced, neverSynced, cancelled];

	const route = randomUUID();
	const restCheckpoint = randomUUID();
	const ongoing = randomUUID();
	const completed = randomUUID();
	const trips = [ongoing, completed];
	const booking = randomUUID();
	const cancelledBooking = randomUUID();
	const syncedMember = randomUUID();
	const neverSyncedMember = randomUUID();
	const removedMember = randomUUID();
	const cancelledMember = randomUUID();
	const latestGps = randomUUID();

	const LNG = 108.2;
	const point = (lat: number) => `SRID=4326;POINT(${LNG} ${lat})`;
	const endpoint = (tripId = ongoing) => `/api/trips/${tripId}/member-locations`;
	const bearer = (id: string, role: string) => `Bearer ${jwt.sign({ sub: id, roles: [role] })}`;
	const read = async (id = host, role = "host"): Promise<TripMemberLocations> => {
		const response = await request(app.getHttpServer())
			.get(endpoint())
			.set("Authorization", bearer(id, role))
			.expect(200);
		return response.body as TripMemberLocations;
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

		for (const [id, role, name] of [
			[host, "host", "Host 66"],
			[otherHost, "host", "Other Host 66"],
			[porter, "porter", "Porter 66"],
			[unassignedPorter, "porter", "Unassigned Porter 66"],
			[synced, "camper", "An Đã Đồng Bộ"],
			[neverSynced, "camper", "Bình Chưa Đồng Bộ"],
			[cancelled, "camper", "Huỷ Booking"],
		]) {
			await db.query(
				"INSERT INTO users(id,email,password_hash,role,status,full_name,phone) VALUES($1,$2,'unused',$3,'active',$4,$5)",
				[id, `${id}@example.test`, role, name, `09${id.replace(/\D/g, "").slice(0, 8)}`]
			);
			await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
		}
		await db.query(
			`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
			 VALUES($1,$2,'Route 66',ST_GeogFromText($3),11000,'moderate',300,'active')`,
			[route, host, `SRID=4326;LINESTRING(${LNG} 16.0, ${LNG} 16.1)`]
		);
		await db.query(
			`INSERT INTO checkpoints(id,route_id,name,location,radius_m,type,expected_arrival_offset,instructions,nearby_water_or_shelter,route_position)
			 VALUES($1,$2,'Trạm nghỉ suối',ST_GeogFromText($3),30,'rest',0,'',false,0.5)`,
			[restCheckpoint, route, point(16.05)]
		);
		for (const [id, status] of [
			[ongoing, "ongoing"],
			[completed, "completed"],
		]) {
			await db.query(
				`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status)
				 VALUES($1,$2,$3,'Trip 66','day_trip',0,now()-interval '3 hours',now()+interval '5 hours',ST_GeogFromText($4),now()-interval '1 day',1,20,0,$5)`,
				[id, host, route, point(16.0), status]
			);
			await db.query(
				"INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned'),($1,$3,'unassigned')",
				[id, porter, unassignedPorter]
			);
		}
		for (const [id, status] of [
			[booking, "confirmed"],
			[cancelledBooking, "cancelled"],
		]) {
			await db.query(
				"INSERT INTO bookings(id,trip_id,user_id,num_people,status,payment_status) VALUES($1,$2,$3,3,$4,'not_required')",
				[id, ongoing, synced, status]
			);
		}
		for (const [id, userId, status, bookingId] of [
			[syncedMember, synced, "joined", booking],
			[neverSyncedMember, neverSynced, "joined", booking],
			[removedMember, cancelled, "removed", booking],
			[cancelledMember, cancelled, "joined", cancelledBooking],
		]) {
			await db.query(
				"INSERT INTO booking_members(id,booking_id,user_id,member_status,checked_in_at) VALUES($1,$2,$3,$4,now()-interval '3 hours')",
				[id, bookingId, userId, status]
			);
		}
		// Porter confirmed the rest stop 35 minutes ago; the synced Camper has not reached it.
		await db.query(
			"INSERT INTO checkpoint_visits(trip_id,checkpoint_id,member_id,confirmed_by_id,arrived_at) VALUES($1,$2,$3,$4,now()-interval '35 minutes')",
			[ongoing, restCheckpoint, neverSyncedMember, porter]
		);
		const gps = (
			id: string,
			userId: string,
			role: string,
			lat: number,
			age: number,
			receivedAge: number
		) =>
			db.query(
				`INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,accuracy_meters,config_version,received_at)
				 VALUES($1,$2,$3,$4,now()-$5::int*interval '1 second',ST_GeogFromText($6),8,'v3',now()-$7::int*interval '1 second')`,
				[id, ongoing, userId, role, age, point(lat), receivedAge]
			);
		await gps(latestGps, synced, "camper", 16.04, 30, 25);
		// An older capture uploaded later (delayed sync) must not replace the newer position.
		await gps(randomUUID(), synced, "camper", 16.01, 900, 1);
		await gps(randomUUID(), porter, "porter", 16.05, 600, 590);
		await db.query(
			`INSERT INTO safety_events(id,trip_id,user_id,participant_role,event_type,event_time,route_id,route_version,config_version,received_at,
			 location,accuracy_meters,distance_to_route_meters,consecutive_valid_samples,no_valid_sample_since)
			 VALUES($1,$2,$3,'camper','OFF_ROUTE',now()-interval '60 seconds',$4,'test-route','v3',now()-interval '40 seconds',
			 ST_GeogFromText($5),8,60,3,NULL)`,
			[randomUUID(), ongoing, synced, route, point(16.04)]
		);
	}, 60000);

	afterAll(async () => {
		if (db?.isInitialized) {
			await assertSafeTestDatabase(db);
			await db.query("DELETE FROM safety_events WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM gps_logs WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM checkpoint_visits WHERE trip_id=ANY($1)", [trips]);
			await db.query("DELETE FROM booking_members WHERE booking_id=ANY($1)", [
				[booking, cancelledBooking],
			]);
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

	it("enforces Host ownership or Porter assignment on the backend (BR-172/173)", async () => {
		const server = app.getHttpServer();
		await request(server).get(endpoint()).expect(401);
		await request(server)
			.get(endpoint())
			.set("Authorization", bearer(synced, "camper"))
			.expect(403);
		await request(server)
			.get(endpoint())
			.set("Authorization", bearer(otherHost, "host"))
			.expect(404);
		await request(server)
			.get(endpoint())
			.set("Authorization", bearer(unassignedPorter, "porter"))
			.expect(404);
		await request(server)
			.get("/api/trips/not-a-uuid/member-locations")
			.set("Authorization", bearer(host, "host"))
			.expect(422);
		await request(server)
			.get(endpoint(completed))
			.set("Authorization", bearer(host, "host"))
			.expect(409);
		expect((await read(porter, "porter")).viewer).toBe("porter");
	});

	it("lists only eligible members, without contact details (BR-246, AC-5)", async () => {
		const result = await read();
		expect(result).toMatchObject({
			tripId: ongoing,
			tripStatus: "ongoing",
			viewer: "host",
			locationSource: "server_confirmed",
			freshnessMaxAgeSeconds: 120,
		});
		expect(result.members.map((member) => member.id).sort()).toEqual(
			[syncedMember, neverSyncedMember, porter].sort()
		);
		expect(JSON.stringify(result)).not.toMatch(/@example\.test|password|phone|health/);
	});

	it("returns the latest server-confirmed capture with last_seen_at, ignoring a delayed older upload", async () => {
		const member = (await read()).members.find((m) => m.id === syncedMember);
		expect(member?.location).toMatchObject({ id: latestGps, latitude: 16.04, longitude: LNG });
		expect(member?.lastSeenAt).toBe(member?.location?.eventTime);
		expect(member?.freshness).toBe("fresh");
		expect(member?.locationAgeSeconds).toBeGreaterThanOrEqual(29);
		// The delayed upload is the most recent receipt even though it is not the latest position.
		expect(Date.now() - Date.parse(member?.lastSyncedAt ?? "")).toBeLessThan(15_000);
	});

	it("keeps a long-offline Porter's last known location as stale and shows no location for a never-synced member", async () => {
		const result = await read();
		const porterRow = result.members.find((m) => m.id === porter);
		expect(porterRow).toMatchObject({ role: "porter", freshness: "stale", memberStatus: null });
		expect(porterRow?.location?.latitude).toBe(16.05);
		expect(porterRow?.safety.behindSchedule).toBeNull();
		const never = result.members.find((m) => m.id === neverSyncedMember);
		expect(never).toMatchObject({
			location: null,
			lastSeenAt: null,
			lastSyncedAt: null,
			freshness: "unavailable",
		});
	});

	it("shows synchronized OFF_ROUTE and the server's behind-schedule evaluation (AC-3)", async () => {
		const member = (await read()).members.find((m) => m.id === syncedMember);
		expect(member?.safety.route).toMatchObject({ type: "OFF_ROUTE" });
		expect(member?.safety.gps).toBeNull();
		expect(member?.safety.behindSchedule).toMatchObject({
			status: "BEHIND",
			reference: { checkpointId: restCheckpoint, checkpointName: "Trạm nghỉ suối" },
			safeCheckpoint: { id: restCheckpoint, name: "Trạm nghỉ suối" },
		});
		expect(member?.safety.behindSchedule?.lagMinutes).toBeGreaterThanOrEqual(35);
		const never = (await read()).members.find((m) => m.id === neverSyncedMember);
		expect(never?.safety.lastCheckpoint).toMatchObject({
			checkpointId: restCheckpoint,
			checkpointName: "Trạm nghỉ suối",
		});
		expect(never?.safety.behindSchedule).toMatchObject({ status: "LOCATION_UNKNOWN" });
	});
});

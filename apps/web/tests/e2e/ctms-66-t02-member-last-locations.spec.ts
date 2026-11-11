import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * CTMS-066-T02 (Jira CTMS-330): the Host's "Vị trí đồng bộ gần nhất" card against the real API
 * (playwright.sos-realtime.config.ts, API :3019 / ctms_79_test).
 */
const apiRequire = createRequire(path.resolve(process.cwd(), "../../services/api/package.json"));
interface TestDatabase {
	connect(): Promise<void>;
	end(): Promise<void>;
	query(sql: string, values?: unknown[]): Promise<unknown>;
}
const { Client } = apiRequire("pg") as {
	Client: new (options: { connectionString: string }) => TestDatabase;
};
const { hash } = apiRequire("bcrypt") as {
	hash: (value: string, rounds: number) => Promise<string>;
};

const databaseUrl =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_79_test";
if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Refusing non-test database");
const db = new Client({ connectionString: databaseUrl });

const password = "Loc66Test!42";
const hostId = randomUUID();
const porterId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const checkpointId = randomUUID();
const hostEmail = `host66-${hostId}@example.test`;
const campers = {
	offRoute: { id: randomUUID(), name: "An Lệch Tuyến" },
	never: { id: randomUUID(), name: "Bình Chưa Đồng Bộ" },
};
const bookingIds: string[] = [];
const LNG = 108.2;
const point = (lat: number) => `SRID=4326;POINT(${LNG} ${lat})`;

test.beforeAll(async () => {
	await db.connect();
	const passwordHash = await hash(password, 4);
	const accounts: Array<[string, string, string, string]> = [
		[hostId, hostEmail, "host", "Host CTMS-66"],
		[porterId, `porter66-${porterId}@example.test`, "porter", "Porter Cũ"],
		...Object.values(campers).map((camper): [string, string, string, string] => [
			camper.id,
			`camper66-${camper.id}@example.test`,
			"camper",
			camper.name,
		]),
	];
	for (const [id, email, role, name] of accounts) {
		await db.query(
			"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,$4,'active',$5)",
			[id, email, passwordHash, role, name]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
	}
	await db.query(
		`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Tuyến kiểm tra CTMS-66',ST_GeogFromText($3),11000,'moderate',300,'active')`,
		[routeId, hostId, `SRID=4326;LINESTRING(${LNG} 16.0, ${LNG} 16.1)`]
	);
	await db.query(
		`INSERT INTO checkpoints(id,route_id,name,location,radius_m,type,expected_arrival_offset,instructions,nearby_water_or_shelter,route_position)
		 VALUES($1,$2,'Đèo Gió',ST_GeogFromText($3),30,'dangerous',0,'',false,0.3)`,
		[checkpointId, routeId, point(16.03)]
	);
	await db.query(
		`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
		 VALUES($1,$2,$3,'Trip vị trí CTMS-66','day_trip',0,now()-interval '3 hours',now()+interval '5 hours',ST_GeogFromText($4),now()-interval '1 day',1,20,2,0,'ongoing')`,
		[tripId, hostId, routeId, point(16.0)]
	);
	await db.query("INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned')", [
		tripId,
		porterId,
	]);
	let offRouteMember = "";
	for (const camper of Object.values(campers)) {
		const bookingId = randomUUID();
		const memberId = randomUUID();
		bookingIds.push(bookingId);
		offRouteMember ||= memberId;
		await db.query(
			"INSERT INTO bookings(id,trip_id,user_id,num_people,total_amount,status) VALUES($1,$2,$3,1,0,'confirmed')",
			[bookingId, tripId, camper.id]
		);
		await db.query(
			"INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at) VALUES($1,$2,$3,true,'joined',now()-interval '3 hours')",
			[memberId, bookingId, camper.id]
		);
	}
	await db.query(
		`INSERT INTO checkpoint_visits(id,trip_id,checkpoint_id,member_id,confirmed_by_id,arrived_at,captured_offline)
		 VALUES($1,$2,$3,$4,$5,now()-interval '20 minutes',false)`,
		[randomUUID(), tripId, checkpointId, offRouteMember, porterId]
	);
	const gps = (userId: string, role: string, lat: number, secondsAgo: number) =>
		db.query(
			`INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,accuracy_meters,config_version,received_at)
			 VALUES($1,$2,$3,$4,now()-make_interval(secs => $5::int),ST_GeogFromText($6),8,'v3',now())`,
			[randomUUID(), tripId, userId, role, secondsAgo, point(lat)]
		);
	await gps(campers.offRoute.id, "camper", 16.04, 20); // fresh
	await gps(porterId, "porter", 16.05, 900); // 15 minutes old → stale
	await db.query(
		`INSERT INTO safety_events(id,trip_id,user_id,participant_role,event_type,event_time,route_id,route_version,config_version,received_at,
		 location,accuracy_meters,distance_to_route_meters,consecutive_valid_samples)
		 VALUES($1,$2,$3,'camper','OFF_ROUTE',now()-interval '40 seconds',$4,'test-route','v3',now(),ST_GeogFromText($5),8,60,3)`,
		[randomUUID(), tripId, campers.offRoute.id, routeId, point(16.04)]
	);
	// campers.never has no upload at all → no server-known location.
});

test.afterAll(async () => {
	const users = [hostId, porterId, ...Object.values(campers).map((camper) => camper.id)];
	await db.query("DELETE FROM safety_events WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM gps_logs WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM checkpoint_visits WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM trip_porters WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM booking_members WHERE booking_id=ANY($1)", [bookingIds]);
	await db.query("DELETE FROM bookings WHERE id=ANY($1)", [bookingIds]);
	await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
	await db.query("DELETE FROM checkpoints WHERE route_id=$1", [routeId]);
	await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
	await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [users]);
	await db.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1)", [users]);
	await db.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [users]);
	await db.query("DELETE FROM users WHERE id=ANY($1)", [users]);
	await db.end();
});

test("Host sees each member's last server-confirmed location with freshness and synced safety flags", async ({
	page,
}, testInfo) => {
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(hostEmail);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
	await page.goto(`/trips/${tripId}`);
	await page.getByRole("button", { name: "Điểm danh & Hoàn tất" }).click();

	const card = page.getByTestId("member-last-locations");
	await expect(card).toBeVisible();
	await expect(card).toContainText("không phải vị trí trực tiếp");
	const rows = card.getByTestId("member-location");
	await expect(rows).toHaveCount(3);
	await expect(
		rows.evaluateAll((items) => items.map((item) => item.getAttribute("data-freshness")))
	).resolves.toEqual(["fresh", "stale", "unavailable"]);

	const offRoute = rows.nth(0);
	await expect(offRoute).toContainText(campers.offRoute.name);
	await expect(offRoute).toContainText("Mới");
	await expect(offRoute).toContainText("Lệch tuyến");
	await expect(offRoute).toContainText("16.04000, 108.20000 · ±8 m");
	await expect(offRoute).toContainText("Checkpoint gần nhất: Đèo Gió");

	const porter = rows.nth(1);
	await expect(porter).toContainText("Porter Cũ");
	await expect(porter).toContainText("Cũ");
	await expect(porter).toContainText("15 phút trước");

	const never = rows.nth(2);
	await expect(never).toContainText(campers.never.name);
	await expect(never).toContainText("Chưa có dữ liệu");
	await expect(never).toContainText("Server chưa nhận được vị trí nào của thành viên này.");

	await card.screenshot({ path: testInfo.outputPath("host-member-last-locations.png") });
});

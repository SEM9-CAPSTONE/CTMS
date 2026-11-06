import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * CTMS-063-T02 (Jira CTMS-320): the Host's "Tiến độ thành viên so với Porter" card against the real
 * API and PostGIS evaluation (playwright.sos-realtime.config.ts, API :3019 / ctms_79_test).
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

const password = "Sched63Test!42";
const hostId = randomUUID();
const porterId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const hostEmail = `host63-${hostId}@example.test`;
const ridgeId = randomUUID();
const restId = randomUUID();
const campers = {
	severe: { id: randomUUID(), name: "An Chậm Nhiều" },
	behind: { id: randomUUID(), name: "Bình Chậm" },
	unknown: { id: randomUUID(), name: "Chi Không GPS" },
	onTrack: { id: randomUUID(), name: "Dũng Theo Kịp" },
};
const bookingIds: string[] = [];
const LNG = 108.2;
const point = (lat: number) => `SRID=4326;POINT(${LNG} ${lat})`;

test.beforeAll(async () => {
	await db.connect();
	const passwordHash = await hash(password, 4);
	const accounts: Array<[string, string, string, string]> = [
		[hostId, hostEmail, "host", "Host CTMS-63"],
		[porterId, `porter63-${porterId}@example.test`, "porter", "Porter CTMS-63"],
		...Object.values(campers).map((camper): [string, string, string, string] => [
			camper.id,
			`camper63-${camper.id}@example.test`,
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
		 VALUES($1,$2,'Tuyến kiểm tra CTMS-63',ST_GeogFromText($3),11000,'moderate',300,'active')`,
		[routeId, hostId, `SRID=4326;LINESTRING(${LNG} 16.0, ${LNG} 16.1)`]
	);
	for (const [id, name, type, lat] of [
		[ridgeId, "Đèo Gió", "dangerous", 16.03],
		[restId, "Trạm nghỉ suối", "rest", 16.05],
	] as const) {
		await db.query(
			`INSERT INTO checkpoints(id,route_id,name,location,radius_m,type,expected_arrival_offset,instructions,nearby_water_or_shelter,route_position)
			 VALUES($1,$2,$3,ST_GeogFromText($4),30,$5,0,'',false,$6)`,
			[id, routeId, name, point(lat), type, Math.round((lat - 16.0) * 1000) / 100]
		);
	}
	await db.query(
		`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
		 VALUES($1,$2,$3,'Trip tiến độ CTMS-63','day_trip',0,now()-interval '3 hours',now()+interval '5 hours',ST_GeogFromText($4),now()-interval '1 day',1,20,4,0,'ongoing')`,
		[tripId, hostId, routeId, point(16.0)]
	);
	await db.query("INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned')", [
		tripId,
		porterId,
	]);

	let firstMemberId = "";
	for (const camper of Object.values(campers)) {
		const bookingId = randomUUID();
		const memberId = randomUUID();
		bookingIds.push(bookingId);
		firstMemberId ||= memberId;
		await db.query(
			"INSERT INTO bookings(id,trip_id,user_id,num_people,total_amount,status) VALUES($1,$2,$3,1,0,'confirmed')",
			[bookingId, tripId, camper.id]
		);
		await db.query(
			"INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at) VALUES($1,$2,$3,true,'joined',now()-interval '3 hours')",
			[memberId, bookingId, camper.id]
		);
	}
	// Porter confirmed Đèo Gió 65 minutes ago and Trạm nghỉ suối 35 minutes ago (CTMS-056).
	for (const [checkpointId, minutes] of [
		[ridgeId, 65],
		[restId, 35],
	] as const) {
		await db.query(
			`INSERT INTO checkpoint_visits(id,trip_id,checkpoint_id,member_id,confirmed_by_id,arrived_at,captured_offline)
			 VALUES($1,$2,$3,$4,$5,now()-make_interval(mins => $6::int),false)`,
			[randomUUID(), tripId, checkpointId, firstMemberId, porterId, minutes]
		);
	}
	const gps = async (userId: string, lat: number, secondsAgo: number) =>
		db.query(
			`INSERT INTO gps_logs(id,trip_id,user_id,participant_role,event_time,location,accuracy_meters,config_version,received_at)
			 VALUES($1,$2,$3,'camper',now()-make_interval(secs => $4::int),ST_GeogFromText($5),8,'v3',now())`,
			[randomUUID(), tripId, userId, secondsAgo, point(lat)]
		);
	await gps(campers.severe.id, 16.02, 30); // not past Đèo Gió → 65 min behind
	await gps(campers.behind.id, 16.0301, 600); // passed Đèo Gió…
	await gps(campers.behind.id, 16.04, 30); // …but not Trạm nghỉ suối → 35 min behind
	await gps(campers.onTrack.id, 16.06, 30); // past both
	// campers.unknown has no GPS at all → LOCATION_UNKNOWN
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

test("Host sees each Camper's lag behind the Porter, most urgent first, with the server's safe checkpoint", async ({
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

	const card = page.getByTestId("team-schedule-progress");
	await expect(card).toBeVisible();
	const rows = card.getByTestId("schedule-progress-member");
	await expect(rows).toHaveCount(4);
	await expect(
		rows.evaluateAll((items) => items.map((item) => item.getAttribute("data-status")))
	).resolves.toEqual(["SEVERELY_BEHIND", "BEHIND", "LOCATION_UNKNOWN", "ON_TRACK"]);

	const severe = rows.nth(0);
	await expect(severe).toContainText(campers.severe.name);
	await expect(severe).toContainText("Chậm nghiêm trọng");
	await expect(severe).toContainText("Porter đã tới Đèo Gió");
	await expect(severe).toContainText(/chậm 6[5-6] phút/);
	await expect(severe).toContainText("Điểm an toàn: Trạm nghỉ suối");
	await expect(severe).toContainText("Dừng tại Trạm nghỉ suối và chờ Porter hướng dẫn.");

	const behind = rows.nth(1);
	await expect(behind).toContainText(campers.behind.name);
	await expect(behind).toContainText("Chậm hơn đoàn");
	await expect(behind).toContainText("Porter đã tới Trạm nghỉ suối");
	await expect(behind).toContainText(/chậm 3[5-6] phút/);

	const unknown = rows.nth(2);
	await expect(unknown).toContainText(campers.unknown.name);
	await expect(unknown).toContainText("Chưa rõ vị trí");
	await expect(unknown).not.toContainText(/chậm \d+ phút/);

	await expect(rows.nth(3)).toContainText("Theo kịp đoàn");
	await card.screenshot({ path: testInfo.outputPath("host-team-schedule-progress.png") });

	// The reached levels are stored exactly once, even after a manual refresh.
	await card.getByRole("button", { name: "Làm mới" }).click();
	await expect(rows).toHaveCount(4);
	const stored = (await db.query(
		"SELECT user_id, warning_level::text AS level FROM safety_events WHERE trip_id=$1 AND event_type::text='BEHIND_SCHEDULE' ORDER BY user_id, level",
		[tripId]
	)) as { rows: Array<{ user_id: string; level: string }> };
	expect(
		stored.rows.filter((row) => row.user_id === campers.severe.id).map((row) => row.level)
	).toEqual(["BEHIND", "SEVERELY_BEHIND"]);
	expect(
		stored.rows.filter((row) => row.user_id === campers.behind.id).map((row) => row.level)
	).toEqual(["BEHIND"]);
	expect(stored.rows.some((row) => row.user_id === campers.unknown.id)).toBe(false);
});

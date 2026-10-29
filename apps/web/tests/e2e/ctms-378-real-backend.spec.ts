import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test } from "@playwright/test";

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
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_378_test";
if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Refusing non-test database");
const db = new Client({ connectionString: databaseUrl });
const hostId = randomUUID();
const otherId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const email = `host378-${hostId}@example.test`;
const password = "Host378Test!42";

test.beforeAll(async () => {
	await db.connect();
	for (const [id, accountEmail] of [
		[hostId, email],
		[otherId, `other-${otherId}@example.test`],
	]) {
		await db.query(
			"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,'host','active','Host CTMS-378')",
			[id, accountEmail, await hash(password, 4)]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,'host')", [id]);
	}
	await db.query(
		`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
	 VALUES($1,$2,'Tuyến kiểm tra CTMS-378',ST_GeogFromText('SRID=4326;LINESTRING(108.45 11.94,108.47 11.95)'),2500,'moderate',180,'active')`,
		[routeId, hostId]
	);
	await db.query(
		`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,price_per_person,status)
	 VALUES($1,$2,$3,'Trip thật CTMS-378','day_trip',0,now()-interval '1 hour',now()+interval '6 hours',ST_GeogFromText('SRID=4326;POINT(108.45 11.94)'),now()-interval '2 hours',1,20,0,'ongoing')`,
		[tripId, hostId, routeId]
	);
	await db.query(
		"INSERT INTO bookings(trip_id,user_id,num_people,status,payment_status) VALUES($1,$2,1,'confirmed','not_required')",
		[tripId, otherId]
	);
	await db.query(
		"INSERT INTO sos_alerts(trip_id,sender_id,emergency_type,status,event_time,received_at) VALUES($1,$2,'medical','active',now(),now())",
		[tripId, otherId]
	);
});
test.afterAll(async () => {
	await db.query("DELETE FROM sos_alerts WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM bookings WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
	await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
	await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [[hostId, otherId]]);
	await db.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1)", [[hostId, otherId]]);
	await db.query("DELETE FROM users WHERE id=ANY($1)", [[hostId, otherId]]);
	await db.end();
});

test("shows actual persisted overview after real UI login and follows a supported Trip link", async ({
	page,
}, testInfo) => {
	// External tiles/media are not part of dashboard data integration.
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	const overview = page.getByTestId("host-dashboard-overview");
	await expect(overview).toBeVisible();
	await expect(
		overview
			.getByRole("region", { name: "Trip đang diễn ra", exact: true })
			.getByText("Trip thật CTMS-378", { exact: true })
	).toBeVisible();
	await expect(overview.getByText("SOS · Y tế")).toBeVisible();
	await overview.screenshot({ path: testInfo.outputPath("host-overview-real-api.png") });
	await expect(
		overview.getByText("Chưa có đánh giá thời tiết khả dụng", { exact: true })
	).toBeVisible();
	await overview
		.getByRole("region", { name: "Trip đang diễn ra", exact: true })
		.getByRole("button", { name: "Xem Trip", exact: true })
		.click();
	await expect(page).toHaveURL(new RegExp(`/trips/${tripId}$`));
});

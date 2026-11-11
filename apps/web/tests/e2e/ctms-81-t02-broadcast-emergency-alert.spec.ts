import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { type Browser, type Page, expect, test } from "@playwright/test";

/**
 * CTMS-081-T02 (Jira CTMS-362): the Host broadcasts an emergency alert from the Trip page and the
 * eligible Camper sees it in real time, against the real API, database and socket.io gateway
 * (playwright.sos-realtime.config.ts). An unrelated Camper receives nothing.
 */
const apiRequire = createRequire(path.resolve(process.cwd(), "../../services/api/package.json"));
interface TestDatabase {
	connect(): Promise<void>;
	end(): Promise<void>;
	query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
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

const password = "Broadcast81Test!42";
const hostId = randomUUID();
const camperId = randomUUID();
const strangerId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const bookingId = randomUUID();
const hostEmail = `host81-${hostId}@example.test`;
const camperEmail = `camper81-${camperId}@example.test`;
const strangerEmail = `stranger81-${strangerId}@example.test`;
const tripTitle = "Trip cảnh báo khẩn CTMS-81";
const alertContent = "Mưa lớn sắp tới. Cả đoàn dừng tại điểm nghỉ gần nhất và chờ Porter.";

test.beforeAll(async () => {
	await db.connect();
	const passwordHash = await hash(password, 4);
	for (const [id, email, role, name] of [
		[hostId, hostEmail, "host", "Host CTMS-81"],
		[camperId, camperEmail, "camper", "Camper CTMS-81"],
		[strangerId, strangerEmail, "camper", "Camper ngoài chuyến CTMS-81"],
	]) {
		await db.query(
			"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,$4,'active',$5)",
			[id, email, passwordHash, role, name]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
	}
	await db.query(
		`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Tuyến kiểm tra CTMS-81',ST_GeogFromText('SRID=4326;LINESTRING(108.2 16.05,108.22 16.07)'),2000,'moderate',120,'active')`,
		[routeId, hostId]
	);
	await db.query(
		`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
		 VALUES($1,$2,$3,$4,'day_trip',0,now()-interval '1 hour',now()+interval '6 hours',ST_GeogFromText('SRID=4326;POINT(108.2 16.05)'),now()-interval '1 day',1,20,1,0,'ongoing')`,
		[tripId, hostId, routeId, tripTitle]
	);
	await db.query(
		"INSERT INTO bookings(id,trip_id,user_id,num_people,total_amount,status) VALUES($1,$2,$3,1,0,'confirmed')",
		[bookingId, tripId, camperId]
	);
	await db.query(
		"INSERT INTO booking_members(id,booking_id,user_id,is_primary,member_status,checked_in_at) VALUES($1,$2,$3,true,'joined',now())",
		[randomUUID(), bookingId, camperId]
	);
});

test.afterAll(async () => {
	const users = [hostId, camperId, strangerId];
	await db.query(
		"DELETE FROM emergency_broadcast_recipients WHERE broadcast_id IN (SELECT id FROM emergency_broadcasts WHERE trip_id=$1)",
		[tripId]
	);
	await db.query("DELETE FROM emergency_broadcasts WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM booking_members WHERE booking_id=$1", [bookingId]);
	await db.query("DELETE FROM bookings WHERE id=$1", [bookingId]);
	await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
	await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
	await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [users]);
	await db.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1)", [users]);
	await db.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [users]);
	await db.query("DELETE FROM users WHERE id=ANY($1)", [users]);
	await db.end();
});

async function signIn(browser: Browser, email: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	// External tiles/media are not part of the broadcast flow.
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
	return page;
}

test("Host broadcasts from the Trip page; the joined Camper sees it live, an unrelated Camper does not", async ({
	browser,
}, testInfo) => {
	const camper = await signIn(browser, camperEmail);
	const stranger = await signIn(browser, strangerEmail);
	const host = await signIn(browser, hostEmail);
	// Give both Camper sockets time to authenticate before the broadcast is sent.
	await camper.waitForTimeout(1_500);

	await host.goto(`/trips/${tripId}`);
	await host.getByRole("button", { name: "Sự cố chuyến đi" }).click();
	const card = host.getByTestId("host-emergency-broadcast");
	await expect(card).toBeVisible();
	await expect(card).toContainText("Chưa phát cảnh báo nào cho chuyến này.");

	await card.getByRole("button", { name: "Phát cảnh báo" }).click();
	await expect(card).toContainText("Chọn loại cảnh báo.");
	await card.getByLabel("Loại cảnh báo").selectOption("severe_weather");
	await card.getByLabel("Nội dung và hướng dẫn").fill(alertContent);
	await card.getByRole("button", { name: "Phát cảnh báo" }).click();
	const confirm = host.getByTestId("confirm-modal");
	await expect(confirm).toContainText("Thời tiết nguy hiểm");
	await card.screenshot({ path: testInfo.outputPath("host-broadcast-form.png") });
	await confirm.getByRole("button", { name: "Phát cảnh báo" }).click();

	await expect(card).toContainText("Đã phát cảnh báo tới 1 người.");
	const sent = card.getByTestId("host-emergency-broadcast-item");
	await expect(sent).toHaveCount(1);
	await expect(sent).toContainText(alertContent);
	await expect(sent).toContainText("1 người nhận");
	await card.screenshot({ path: testInfo.outputPath("host-broadcast-history.png") });

	const banner = camper.getByTestId("emergency-broadcast-alert");
	await expect(banner).toBeVisible({ timeout: 5_000 });
	await expect(banner).toContainText("Thời tiết nguy hiểm");
	await expect(banner).toContainText(tripTitle);
	await expect(banner).toContainText(alertContent);
	await camper.screenshot({ path: testInfo.outputPath("camper-broadcast-banner.png") });
	await banner.getByRole("button", { name: "Đã đọc" }).click();
	await expect(banner).toHaveCount(0);

	// The Camper can still read the alert on the Booking page (also how a missed alert is recovered).
	await camper.goto(`/bookings/${bookingId}`);
	const received = camper.getByTestId("received-emergency-broadcasts");
	await expect(received).toContainText(alertContent);
	await received.screenshot({ path: testInfo.outputPath("camper-received-card.png") });

	await stranger.waitForTimeout(1_000);
	await expect(stranger.getByTestId("emergency-broadcast-alert")).toHaveCount(0);

	const stored = await db.query(
		"SELECT alert_type, content, recipient_count FROM emergency_broadcasts WHERE trip_id=$1",
		[tripId]
	);
	expect(stored.rows).toEqual([
		{ alert_type: "severe_weather", content: alertContent, recipient_count: 1 },
	]);
});

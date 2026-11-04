import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { type Browser, type Page, expect, request, test } from "@playwright/test";

/**
 * CTMS-079-T02 (Jira CTMS-358): real-time SOS delivery to the Host web client against the real API,
 * database and socket.io gateway (playwright.sos-realtime.config.ts). The dashboard polls every 30 s
 * and the SOS center every 15 s, so anything seen within the 5 s BR-260 budget came over the socket.
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

const API_URL = "http://127.0.0.1:3019/api";
const SOS_DELIVERY_BUDGET_MS = 5_000;
const databaseUrl =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_79_test";
if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Refusing non-test database");
const db = new Client({ connectionString: databaseUrl });

const password = "Sos79Test!42";
const hostId = randomUUID();
const otherHostId = randomUUID();
const camperId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const bookingId = randomUUID();
const hostEmail = `host79-${hostId}@example.test`;
const otherHostEmail = `other79-${otherHostId}@example.test`;
const camperEmail = `camper79-${camperId}@example.test`;
const tripTitle = "Trip SOS thời gian thực CTMS-79";

test.beforeAll(async () => {
	await db.connect();
	const passwordHash = await hash(password, 4);
	for (const [id, email, role, name] of [
		[hostId, hostEmail, "host", "Host CTMS-79"],
		[otherHostId, otherHostEmail, "host", "Host khác CTMS-79"],
		[camperId, camperEmail, "camper", "Camper CTMS-79"],
	]) {
		await db.query(
			"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,$4,'active',$5)",
			[id, email, passwordHash, role, name]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
	}
	await db.query(
		`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Tuyến kiểm tra CTMS-79',ST_GeogFromText('SRID=4326;LINESTRING(108.2 16.05,108.22 16.07)'),2000,'moderate',120,'active')`,
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
	const users = [hostId, otherHostId, camperId];
	await db.query(
		`DELETE FROM audit_logs WHERE target_type='sos_alert' AND target_id IN (SELECT id FROM sos_alerts WHERE trip_id=$1)`,
		[tripId]
	);
	await db.query("DELETE FROM sos_alerts WHERE trip_id=$1", [tripId]);
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

async function signInHost(browser: Browser, email: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	// External tiles/media are not part of SOS delivery.
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	// The develop dashboard currently renders the overview twice (header + body); either copy works.
	await expect(page.getByTestId("host-dashboard-overview").first()).toBeVisible();
	return page;
}

/** The Camper raises an SOS through the real API, exactly as the mobile app does. */
async function raiseSos(emergencyType: string): Promise<{ id: string; persistedAt: number }> {
	const api = await request.newContext({ baseURL: `${API_URL}/` });
	const login = await api.post("auth/login", { data: { identifier: camperEmail, password } });
	expect(login.ok()).toBeTruthy();
	const { accessToken } = (await login.json()) as { accessToken: string };
	const created = await api.post(`trips/${tripId}/sos`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		data: {
			emergencyType,
			location: { latitude: 16.052, longitude: 108.205 },
			batteryLevel: 35,
			eventTime: new Date().toISOString(),
		},
	});
	expect(created.status()).toBe(201);
	const body = (await created.json()) as { id: string; receivedAt: string };
	await api.dispose();
	return { id: body.id, persistedAt: Date.parse(body.receivedAt) };
}

function realtimeStatus(page: Page) {
	return page.getByTestId("sos-realtime-status").first();
}

test("authorized Host gets the SOS in real time with attention signal and acknowledge action; other Host gets nothing", async ({
	browser,
}, testInfo) => {
	const host = await signInHost(browser, hostEmail);
	const otherHost = await signInHost(browser, otherHostEmail);
	await expect(realtimeStatus(host)).toHaveAttribute("data-state", "live");
	await expect(realtimeStatus(otherHost)).toHaveAttribute("data-state", "live");
	await expect(host.getByTestId("emergency-alert-banner")).toHaveCount(0);

	const sos = await raiseSos("injury");

	const banner = host.getByTestId("emergency-alert-banner").first();
	await expect(banner).toBeVisible({ timeout: SOS_DELIVERY_BUDGET_MS });
	const shownAt = Date.now();
	await expect(host.getByText("Yêu cầu cứu trợ khẩn cấp", { exact: true })).toBeVisible();
	await expect(banner).toContainText("Chấn thương");
	await expect(banner).toContainText(`Mã chuyến: ${tripId.slice(0, 8)}`);
	const latencyMs = shownAt - sos.persistedAt;
	testInfo.annotations.push({ type: "sos-latency-ms", description: String(latencyMs) });
	expect(latencyMs).toBeLessThan(SOS_DELIVERY_BUDGET_MS);
	await host.screenshot({ path: testInfo.outputPath("host-dashboard-sos-realtime.png") });

	// PB AC-3: a Host who does not manage this Trip receives no alert.
	await host.waitForTimeout(1_000);
	await expect(otherHost.getByText("Yêu cầu cứu trợ khẩn cấp", { exact: true })).toHaveCount(0);
	await expect(otherHost.getByTestId("emergency-alert-banner")).toHaveCount(0);

	// Receipt is not acknowledgement: the SOS stays active until the Host acts (CTMS-080).
	const stored = (await db.query("SELECT status FROM sos_alerts WHERE id=$1", [sos.id])) as {
		rows: Array<{ status: string }>;
	};
	expect(stored.rows[0].status).toBe("active");

	// PB AC-5: the acknowledge action is reachable straight from the attention signal.
	await banner.getByRole("button", { name: "Tiếp nhận ngay" }).click();
	await host.getByRole("button", { name: "Tiếp nhận SOS" }).click();
	await expect(host.getByTestId("emergency-alert-banner")).toHaveCount(0);
	await host.waitForTimeout(500);
	await expect(otherHost.getByText("Yêu cầu cứu trợ khẩn cấp", { exact: true })).toHaveCount(0);

	await host.context().close();
	await otherHost.context().close();
});

test("SOS center shows real-time, disconnected and recovered states and reloads an SOS missed while offline", async ({
	browser,
}, testInfo) => {
	const host = await signInHost(browser, hostEmail);
	await host.goto("/host/sos");
	await expect(host.getByRole("heading", { name: "Yêu cầu cứu trợ khẩn cấp" })).toBeVisible();
	await expect(realtimeStatus(host)).toHaveAttribute("data-state", "live");

	await raiseSos("medical");
	await expect(host.getByText("Yêu cầu cứu trợ khẩn cấp", { exact: true }).last()).toBeVisible({
		timeout: SOS_DELIVERY_BUDGET_MS,
	});
	await expect(host.getByRole("cell", { name: /Sự cố y tế|Y tế/ }).first()).toBeVisible({
		timeout: SOS_DELIVERY_BUDGET_MS,
	});

	// Connection loss: the page must stop claiming real-time delivery.
	await host.context().setOffline(true);
	await expect(realtimeStatus(host)).toHaveAttribute("data-state", "disconnected", {
		timeout: 30_000,
	});
	await host.screenshot({ path: testInfo.outputPath("host-sos-center-disconnected.png") });

	const missed = await raiseSos("lost");

	await host.context().setOffline(false);
	await expect(realtimeStatus(host)).toHaveAttribute("data-state", "recovered", {
		timeout: 30_000,
	});
	await expect(host.getByRole("cell", { name: /Lạc/ }).first()).toBeVisible({
		timeout: SOS_DELIVERY_BUDGET_MS,
	});
	await host.screenshot({ path: testInfo.outputPath("host-sos-center-recovered.png") });
	await expect(realtimeStatus(host)).toHaveAttribute("data-state", "live", { timeout: 10_000 });

	const result = (await db.query("SELECT count(*)::int AS n FROM sos_alerts WHERE id=$1", [
		missed.id,
	])) as { rows: Array<{ n: number }> };
	expect(result.rows[0].n).toBe(1);
	await host.context().close();
});

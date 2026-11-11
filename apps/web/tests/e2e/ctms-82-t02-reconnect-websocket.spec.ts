import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { type Browser, type Page, type WebSocket, expect, request, test } from "@playwright/test";

/**
 * CTMS-082-T02 (Jira CTMS-364): automatic reconnect against the real API, database and socket.io
 * gateway (playwright.sos-realtime.config.ts, API :3019 / ctms_79_test). An event published while
 * the browser is offline is recovered through `realtime.resume` after the reconnect, shown once.
 */
const apiRequire = createRequire(path.resolve(process.cwd(), "../../services/api/package.json"));
interface TestDatabase {
	connect(): Promise<void>;
	end(): Promise<void>;
	query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}
const { Client } = apiRequire("pg") as {
	Client: new (options: { connectionString: string }) => TestDatabase;
};
const { hash } = apiRequire("bcrypt") as {
	hash: (value: string, rounds: number) => Promise<string>;
};

const API_URL = "http://127.0.0.1:3019/api";
const databaseUrl =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_79_test";
if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Refusing non-test database");
const db = new Client({ connectionString: databaseUrl });

const password = "Ws82Test!42";
const adminId = randomUUID();
const hostId = randomUUID();
const camperId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const bookingId = randomUUID();
const adminEmail = `admin82-${adminId}@example.test`;
const hostEmail = `host82-${hostId}@example.test`;
const camperEmail = `camper82-${camperId}@example.test`;
const tripTitle = "Trip kết nối lại CTMS-82";
const missedAlert = "Sạt lở phía trước. Cả đoàn quay lại điểm nghỉ số 2 và chờ Host.";

test.beforeAll(async () => {
	await db.connect();
	const passwordHash = await hash(password, 4);
	for (const [id, email, role, name] of [
		[adminId, adminEmail, "admin", "Admin CTMS-82"],
		[hostId, hostEmail, "host", "Host CTMS-82"],
		[camperId, camperEmail, "camper", "Camper CTMS-82"],
	]) {
		await db.query(
			"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,$4,'active',$5)",
			[id, email, passwordHash, role, name]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
	}
	await db.query(
		`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Tuyến kiểm tra CTMS-82',ST_GeogFromText('SRID=4326;LINESTRING(108.2 16.05,108.22 16.07)'),2000,'moderate',120,'active')`,
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
	const users = [adminId, hostId, camperId];
	await db.query(
		"DELETE FROM emergency_broadcast_recipients WHERE broadcast_id IN (SELECT id FROM emergency_broadcasts WHERE trip_id=$1)",
		[tripId]
	);
	await db.query("DELETE FROM emergency_broadcasts WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM realtime_events WHERE user_ids && $1::uuid[] OR trip_id=$2", [
		users,
		tripId,
	]);
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

interface SocketWatch {
	/** Resolves when the page's current socket.io connection closes. */
	closed: () => Promise<void>;
	/** Text frames the page sent on any of its sockets. */
	sent: string[];
}

function watchSockets(page: Page): SocketWatch {
	const sent: string[] = [];
	let current: WebSocket | null = null;
	page.on("websocket", (ws) => {
		if (!ws.url().includes("socket.io")) return;
		current = ws;
		ws.on("framesent", (frame) => {
			if (typeof frame.payload === "string") sent.push(frame.payload);
		});
	});
	return {
		sent,
		closed: async () => {
			await expect.poll(() => current !== null, { timeout: 15_000 }).toBe(true);
			const ws = current as unknown as WebSocket;
			if (ws.isClosed()) return;
			await ws.waitForEvent("close", { timeout: 45_000 });
		},
	};
}

async function signIn(
	browser: Browser,
	email: string
): Promise<{ page: Page; sockets: SocketWatch }> {
	const context = await browser.newContext();
	const page = await context.newPage();
	const sockets = watchSockets(page);
	// External tiles/media are not part of the real-time channel.
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('form input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
	return { page, sockets };
}

/** The Host broadcasts through the real API (the test runner is never offline). */
async function broadcastAsHost(content: string): Promise<void> {
	const api = await request.newContext({ baseURL: `${API_URL}/` });
	const login = await api.post("auth/login", { data: { identifier: hostEmail, password } });
	expect(login.ok()).toBeTruthy();
	const { accessToken } = (await login.json()) as { accessToken: string };
	const created = await api.post(`trips/${tripId}/emergency-broadcasts`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		data: { id: randomUUID(), alertType: "route_hazard", content },
	});
	expect(created.ok(), await created.text()).toBeTruthy();
	await api.dispose();
}

test("an emergency alert sent while the Camper is offline is recovered after the reconnect and shown once", async ({
	browser,
}, testInfo) => {
	const { page: camper, sockets } = await signIn(browser, camperEmail);
	// Let the authenticated socket receive its first cursor.
	await camper.waitForTimeout(1_500);
	const banner = camper.getByTestId("emergency-broadcast-alert");
	await expect(banner).toHaveCount(0);

	await camper.context().setOffline(true);
	await sockets.closed();
	await broadcastAsHost(missedAlert);
	// Nothing can reach an offline browser.
	await camper.waitForTimeout(1_000);
	await expect(banner).toHaveCount(0);

	await camper.context().setOffline(false);
	// The alert is pushed-only (no polling), so it can only come from realtime.resume.
	await expect(banner).toHaveCount(1, { timeout: 30_000 });
	await expect(banner).toContainText(missedAlert);
	await expect(banner).toContainText(tripTitle);
	expect(sockets.sent.some((frame) => frame.includes('"realtime.resume"'))).toBe(true);
	await camper.screenshot({ path: testInfo.outputPath("camper-recovered-alert.png") });

	// A second reconnect replays nothing new: the alert is still shown once.
	await camper.context().setOffline(true);
	await sockets.closed();
	await camper.context().setOffline(false);
	await camper.waitForTimeout(5_000);
	await expect(banner).toHaveCount(1);
	await camper.context().close();
});

test("the Admin review page shows reconnecting while offline and connected again after recovery", async ({
	browser,
}, testInfo) => {
	const { page: admin, sockets } = await signIn(browser, adminEmail);
	await admin.goto("/admin/trips");
	const status = admin.getByTestId("trip-review-realtime-status");
	await expect(status).toHaveAttribute("data-state", "connected");

	await admin.context().setOffline(true);
	await expect(status).toHaveAttribute("data-state", /reconnecting|disconnected/, {
		timeout: 45_000,
	});
	await expect(status).toContainText(/kết nối lại|Mất kết nối/);
	await admin.screenshot({ path: testInfo.outputPath("admin-reconnecting.png") });

	await admin.context().setOffline(false);
	await expect(status).toHaveAttribute("data-state", "connected", { timeout: 45_000 });
	await expect
		.poll(() => sockets.sent.some((frame) => frame.includes('"realtime.resume"')), {
			timeout: 10_000,
		})
		.toBe(true);
	await expect(status).not.toHaveAttribute("data-state", "recovery_failed");
	await admin.screenshot({ path: testInfo.outputPath("admin-reconnected.png") });
	await admin.context().close();
});

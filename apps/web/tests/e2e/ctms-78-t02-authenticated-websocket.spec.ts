import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { type Browser, type Page, expect, request, test } from "@playwright/test";

/**
 * CTMS-078-T02 (Jira CTMS-356): the web client's authenticated WebSocket against the real API,
 * database and socket.io gateway (playwright.sos-realtime.config.ts, API :3019 / ctms_79_test).
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
const { JwtService } = apiRequire("@nestjs/jwt") as {
	JwtService: new (options: { secret: string }) => {
		sign: (payload: object, options?: { expiresIn?: number }) => string;
	};
};

const API_URL = "http://127.0.0.1:3019/api";
/** Must match services/api/test/e2e/start-sos-realtime-server.ts. */
const E2E_JWT_SECRET = "ctms79-isolated-e2e-secret";
const REALTIME_BUDGET_MS = 5_000;
const databaseUrl =
	process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_79_test";
if (!new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Refusing non-test database");
const db = new Client({ connectionString: databaseUrl });

const password = "Ws78Test!42";
const adminId = randomUUID();
const hostId = randomUUID();
const porterId = randomUUID();
const routeId = randomUUID();
const tripId = randomUUID();
const adminEmail = `admin78-${adminId}@example.test`;
const hostEmail = `host78-${hostId}@example.test`;
const porterEmail = `porter78-${porterId}@example.test`;

test.beforeAll(async () => {
	await db.connect();
	const passwordHash = await hash(password, 4);
	for (const [id, email, role, name] of [
		[adminId, adminEmail, "admin", "Admin CTMS-78"],
		[hostId, hostEmail, "host", "Host CTMS-78"],
		[porterId, porterEmail, "porter", "Porter CTMS-78"],
	]) {
		await db.query(
			"INSERT INTO users(id,email,password_hash,role,status,full_name) VALUES($1,$2,$3,$4,'active',$5)",
			[id, email, passwordHash, role, name]
		);
		await db.query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)", [id, role]);
	}
	await db.query(
		`INSERT INTO trekking_routes(id,host_id,name,route_geom,length_meters,difficulty,expected_duration_minutes,status)
		 VALUES($1,$2,'Tuyến kiểm tra CTMS-78',ST_GeogFromText('SRID=4326;LINESTRING(108.2 16.05,108.22 16.07)'),2000,'moderate',120,'active')`,
		[routeId, hostId]
	);
	await db.query(
		`INSERT INTO trips(id,host_id,route_id,title,trip_type,duration_nights,starts_at,ends_at,meeting_point,booking_deadline,capacity_min,capacity_max,seats_taken,price_per_person,status)
		 VALUES($1,$2,$3,'Trip WebSocket CTMS-78','day_trip',0,now()-interval '1 hour',now()+interval '6 hours',ST_GeogFromText('SRID=4326;POINT(108.2 16.05)'),now()-interval '1 day',1,20,0,0,'ongoing')`,
		[tripId, hostId, routeId]
	);
	await db.query("INSERT INTO trip_porters(trip_id,porter_id,status) VALUES($1,$2,'assigned')", [
		tripId,
		porterId,
	]);
});

test.afterAll(async () => {
	const users = [adminId, hostId, porterId];
	await db.query("DELETE FROM trip_incidents WHERE trip_id=$1", [tripId]).catch(() => undefined);
	await db.query("DELETE FROM trip_porters WHERE trip_id=$1", [tripId]);
	await db.query("DELETE FROM trips WHERE id=$1", [tripId]);
	await db.query("DELETE FROM trekking_routes WHERE id=$1", [routeId]);
	await db.query("DELETE FROM audit_logs WHERE actor_id=ANY($1)", [users]);
	await db.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1)", [users]);
	await db.query("DELETE FROM user_roles WHERE user_id=ANY($1)", [users]);
	await db.query("DELETE FROM users WHERE id=ANY($1)", [users]);
	await db.end();
});

async function signIn(browser: Browser, email: string, landing: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	// External tiles/media are not part of the real-time channel.
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
	await page.goto(landing);
	return page;
}

/** The assigned Porter reports an incident through the real API. */
async function reportIncident(description: string): Promise<void> {
	const api = await request.newContext({ baseURL: `${API_URL}/` });
	const login = await api.post("auth/login", { data: { identifier: porterEmail, password } });
	expect(login.ok()).toBeTruthy();
	const { accessToken } = (await login.json()) as { accessToken: string };
	const now = new Date().toISOString();
	const created = await api.post(`trips/${tripId}/incidents`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		data: {
			id: randomUUID(),
			category: "injury",
			severity: "high",
			description,
			occurredAt: now,
			location: { latitude: 16.052, longitude: 108.205, accuracyMeters: 8, capturedAt: now },
			capturedOffline: false,
		},
	});
	expect(created.ok(), await created.text()).toBeTruthy();
	expect(((await created.json()) as { outcome: string }).outcome).toBe("created");
	await api.dispose();
}

test("Host Trip page joins the server-authorized Trip room and shows a new incident in real time", async ({
	browser,
}, testInfo) => {
	const host = await signIn(browser, hostEmail, `/trips/${tripId}`);
	await host.getByRole("button", { name: "Sự cố chuyến đi" }).click();
	const status = host.getByTestId("incidents-realtime-status");
	await expect(status).toHaveAttribute("data-state", "connected");
	await expect(status).toContainText("Đang nhận cập nhật thời gian thực");

	const injuryRow = host.getByRole("row").filter({ hasText: "Chấn thương" });
	await expect(injuryRow).toHaveCount(0);

	await reportIncident(`Porter trượt chân tại điểm nghỉ ${randomUUID().slice(0, 6)}`);

	// The incident list has no polling interval: this row can only come from the Trip-room event.
	await expect(injuryRow).toHaveCount(1, { timeout: REALTIME_BUDGET_MS });
	await host.screenshot({ path: testInfo.outputPath("host-incidents-trip-room.png") });
	await host.context().close();
});

test("Admin review page opens an authenticated role-scoped channel and shows reconnecting while offline", async ({
	browser,
}, testInfo) => {
	const admin = await signIn(browser, adminEmail, "/admin/trips");
	const status = admin.getByTestId("trip-review-realtime-status");
	await expect(status).toHaveAttribute("data-state", "connected");
	await admin.screenshot({ path: testInfo.outputPath("admin-review-connected.png") });

	await admin.context().setOffline(true);
	await expect(status).toHaveAttribute("data-state", /reconnecting|disconnected/, {
		timeout: 30_000,
	});
	await admin.screenshot({ path: testInfo.outputPath("admin-review-reconnecting.png") });

	await admin.context().setOffline(false);
	await expect(status).toHaveAttribute("data-state", "connected", { timeout: 30_000 });
	await admin.context().close();
});

test("an expired access token is recovered through the refresh flow before the channel goes live", async ({
	browser,
}) => {
	const admin = await signIn(browser, adminEmail, "/admin/trips");
	await expect(admin.getByTestId("trip-review-realtime-status")).toHaveAttribute(
		"data-state",
		"connected"
	);

	const expired = new JwtService({ secret: E2E_JWT_SECRET }).sign(
		{ sub: adminId, roles: ["admin"] },
		{ expiresIn: -60 }
	);
	await admin.evaluate((token) => localStorage.setItem("accessToken", token), expired);
	await admin.reload();

	await expect(admin.getByTestId("trip-review-realtime-status")).toHaveAttribute(
		"data-state",
		"connected",
		{ timeout: 15_000 }
	);
	const current = await admin.evaluate(() => localStorage.getItem("accessToken"));
	expect(current).not.toBe(expired);
	await admin.context().close();
});

test("a session that cannot be refreshed is cleared and sent to Login", async ({ browser }) => {
	const admin = await signIn(browser, adminEmail, "/admin/trips");
	await expect(admin.getByTestId("trip-review-realtime-status")).toHaveAttribute(
		"data-state",
		"connected"
	);

	await admin.evaluate(() => {
		localStorage.setItem("accessToken", "invalid.token.value");
		localStorage.setItem("refreshToken", "revoked-refresh-token");
	});
	await admin.reload();

	await expect(admin).toHaveURL(/\/login/, { timeout: 15_000 });
	expect(await admin.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();
	await admin.context().close();
});

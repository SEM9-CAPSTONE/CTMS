import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services", "api");
const TS_NODE_BIN = path.join(API_ROOT, "node_modules", "ts-node", "dist", "bin.js");
const DB_HELPER = path.join(API_ROOT, "src", "seeds", "db-helper.ts");
const PASSWORD = "S3curePass!";
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = (prefix: string) => `e2e-${unique(prefix)}@example.com`;
const phone = () =>
	`09${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0")}`;

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, encoded], {
		cwd: API_ROOT,
	}).toString();
	return JSON.parse(stdout) as T;
}

function dbPlain(action: string, value: string) {
	execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, value], { cwd: API_ROOT });
}

async function login(page: Page, userEmail: string) {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

/**
 * CTMS-25-T02. Real backend + real Postgres + a REAL call to the live
 * Open-Meteo API on the happy path (no mocking) -- same posture as
 * CTMS-25-T01's own integration test and this codebase's established E2E
 * convention (real SMTP OTP delivery, etc.).
 */
test.describe("CTMS-25-T02 Retrieve Weather Data for Trekking Area (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);
	const ownerEmail = email("ctms25t02-owner");
	const camperEmail = email("ctms25t02-camper");
	const activeRouteName = `E2E CTMS25T02 Active Route ${Date.now()}`;
	const draftRouteName = `E2E CTMS25T02 Draft Route ${Date.now()}`;
	let ownerId = "";
	let campsiteId = "";
	let activeRouteId = "";
	let draftRouteId = "";

	test.beforeAll(() => {
		ownerId = db<{ id: string }>("create-account", {
			email: ownerEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		db("create-account", {
			email: camperEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		});
		campsiteId = db<{ campsites: Array<{ id: string }> }>("seed-campsites", {
			hostId: ownerId,
			campsites: [
				{ name: `E2E CTMS25T02 Camp ${Date.now()}`, province: "CTMS25T02E2E", status: "draft" },
			],
		}).campsites[0].id;
		const routes = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [
				{ name: activeRouteName, status: "active" },
				{ name: draftRouteName, status: "draft" },
			],
		}).routes;
		activeRouteId = routes[0].id;
		draftRouteId = routes[1].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds: [activeRouteId, draftRouteId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-campsites", { hostIds: [], campsiteIds: [campsiteId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [ownerEmail, camperEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("owning Host refreshes real weather for an active Route and sees it persisted", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(activeRouteName).click();

		await expect(page.getByTestId("weather-empty")).toBeVisible();
		await page.getByRole("button", { name: "Làm mới thời tiết" }).click();

		const snapshot = page.getByTestId("weather-snapshot");
		await expect(snapshot).toBeVisible({ timeout: 20_000 });
		await expect(snapshot).toContainText("mm");
		await expect(snapshot).toContainText("km/h");
		await expect(snapshot).toContainText("°C");

		// Real DB row, not just a UI illusion.
		const { snapshots } = db<{ snapshots: Array<{ status: string; provider_response: unknown }> }>(
			"get-weather-snapshots",
			{ routeId: activeRouteId }
		);
		expect(snapshots).toHaveLength(1);
		expect(snapshots[0].status).toBe("success");
		expect(snapshots[0].provider_response).not.toBeNull();
	});

	test("a draft (non-active) Route disables refresh and creates no snapshot even via direct API", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(draftRouteName).click();

		await expect(page.getByTestId("weather-empty")).toBeVisible();
		await expect(page.getByRole("button", { name: "Làm mới thời tiết" })).toBeDisabled();
		await expect(page.getByText("Chỉ làm mới được khi tuyến đang Hoạt động")).toBeVisible();

		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.post(
			`http://localhost:3000/api/trekking-routes/${draftRouteId}/weather/refresh`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
		expect(response.status()).toBe(409);

		const { snapshots } = db<{ snapshots: unknown[] }>("get-weather-snapshots", {
			routeId: draftRouteId,
		});
		expect(snapshots).toHaveLength(0);
	});

	test("a Camper's direct API refresh attempt returns 403 and creates no snapshot", async ({
		page,
	}) => {
		await login(page, camperEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.post(
			`http://localhost:3000/api/trekking-routes/${activeRouteId}/weather/refresh`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);

		expect(response.status()).toBe(403);
		const { snapshots } = db<{ snapshots: Array<{ status: string }> }>("get-weather-snapshots", {
			routeId: activeRouteId,
		});
		// Unchanged from the first test's own single successful row -- the
		// Camper's forbidden attempt added nothing.
		expect(snapshots).toHaveLength(1);
	});
});

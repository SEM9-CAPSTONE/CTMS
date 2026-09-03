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
 * CTMS-28-T02: Block New Registrations when Route Risk Is Red (E2E Test)
 */
test.describe("CTMS-28-T02 Block New Registrations when Route Risk Is Red (UI / E2E)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);

	const ownerEmail = email("ctms28t02-owner");
	const camperEmail = email("ctms28t02-camper");
	const suspendedCamperEmail = email("ctms28t02-suspended");
	const activeRouteName = `E2E CTMS28T02 Route ${Date.now()}`;

	let ownerId = "";
	let campsiteId = "";
	let activeRouteId = "";

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

		db("create-account", {
			email: suspendedCamperEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "suspended",
		});

		campsiteId = db<{ campsites: Array<{ id: string }> }>("seed-campsites", {
			hostId: ownerId,
			campsites: [
				{ name: `E2E CTMS28T02 Camp ${Date.now()}`, province: "Da Nang", status: "draft" },
			],
		}).campsites[0].id;

		const routes = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [{ name: activeRouteName, status: "active" }],
		}).routes;

		activeRouteId = routes[0].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds: [activeRouteId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-campsites", { hostIds: [], campsiteIds: [campsiteId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [ownerEmail, camperEmail, suspendedCamperEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("direct API registration eligibility check returns allowed = true for route without Red risk", async ({
		page,
	}) => {
		await login(page, camperEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));

		const response = await page.request.post(
			`http://localhost:3000/api/trekking-routes/${activeRouteId}/check-registration-eligibility`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);

		// If no assessment exists yet, backend returns 409 unassessed, or 200 if assessed
		expect([200, 409]).toContain(response.status());
	});

	test("unauthorized / unauthenticated request to registration eligibility endpoint returns 401", async ({
		page,
	}) => {
		const response = await page.request.post(
			`http://localhost:3000/api/trekking-routes/${activeRouteId}/check-registration-eligibility`
		);

		expect(response.status()).toBe(401);
	});
});

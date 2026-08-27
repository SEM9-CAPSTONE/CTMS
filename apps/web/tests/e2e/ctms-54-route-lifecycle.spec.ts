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

test.describe("CTMS-54 / CTMS-21 Close or Reopen Route", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);
	const ownerEmail = email("ctms54-owner");
	const foreignHostEmail = email("ctms54-foreign-host");
	const adminEmail = email("ctms54-admin");
	const hostRouteName = `E2E CTMS54 Host Route ${Date.now()}`;
	const adminRouteName = `E2E CTMS54 Admin Route ${Date.now()}`;
	let ownerId = "";
	let campsiteId = "";
	let hostRouteId = "";
	let adminRouteId = "";

	test.beforeAll(() => {
		ownerId = db<{ id: string }>("create-account", {
			email: ownerEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		db("create-account", {
			email: foreignHostEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		});
		db("create-account", {
			email: adminEmail,
			phone: phone(),
			password: PASSWORD,
			role: "admin",
			status: "active",
		});
		campsiteId = db<{ campsites: Array<{ id: string }> }>("seed-campsites", {
			hostId: ownerId,
			campsites: [
				{ name: `E2E CTMS54 Camp ${Date.now()}`, province: "CTMS54E2E", status: "draft" },
			],
		}).campsites[0].id;
		const routes = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [
				{ name: hostRouteName, status: "active" },
				{ name: adminRouteName, status: "active" },
			],
		}).routes;
		hostRouteId = routes[0].id;
		adminRouteId = routes[1].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds: [hostRouteId, adminRouteId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-campsites", { hostIds: [], campsiteIds: [campsiteId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [ownerEmail, foreignHostEmail, adminEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("owning Host closes an active Route and sees authoritative closed state", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(hostRouteName).click();
		await page.getByRole("button", { name: "Đóng tuyến đường" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Lý do").fill("Heavy rain made the trail unsafe");
		await dialog.getByRole("button", { name: "Đóng tuyến đường" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("button", { name: "Mở lại tuyến đường" })).toBeVisible();
		expect(
			db<{ route: { status: string } }>("get-trekking-route", { routeId: hostRouteId }).route.status
		).toBe("closed");
	});

	test("owning Host reopens a closed Route into pending approval", async ({ page }) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(hostRouteName).click();
		await page.getByRole("button", { name: "Mở lại tuyến đường" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Lý do").fill("Inspection completed and route data remains valid");
		await dialog.getByRole("button", { name: "Mở lại tuyến đường" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Chờ duyệt")).toBeVisible();
		await expect(page.getByRole("button", { name: /tuyến đường/ })).toHaveCount(0);
		expect(
			db<{ route: { status: string } }>("get-trekking-route", { routeId: hostRouteId }).route.status
		).toBe("pending_approval");
	});

	test("foreign Host direct API lifecycle mutation returns 403 with no change", async ({
		page,
	}) => {
		await login(page, foreignHostEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.patch(
			`http://localhost:3000/api/trekking-routes/${adminRouteId}/close`,
			{
				headers: { Authorization: `Bearer ${token}` },
				data: { reason: "Foreign Host attempt" },
			}
		);

		expect(response.status()).toBe(403);
		expect(
			db<{ route: { status: string } }>("get-trekking-route", { routeId: adminRouteId }).route
				.status
		).toBe("active");
	});

	test("invalid transition returns 409 with no lifecycle change", async ({ page }) => {
		await login(page, ownerEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.patch(
			`http://localhost:3000/api/trekking-routes/${adminRouteId}/reopen`,
			{
				headers: { Authorization: `Bearer ${token}` },
				data: { reason: "Cannot reopen an active route" },
			}
		);

		expect(response.status()).toBe(409);
		expect(
			db<{ route: { status: string } }>("get-trekking-route", { routeId: adminRouteId }).route
				.status
		).toBe("active");
	});

	test("Admin API can close and reopen a Route without Host ownership", async ({ page }) => {
		await login(page, adminEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const headers = { Authorization: `Bearer ${token}` };
		const close = await page.request.patch(
			`http://localhost:3000/api/trekking-routes/${adminRouteId}/close`,
			{ headers, data: { reason: "Admin safety closure" } }
		);
		expect(close.status()).toBe(200);
		expect((await close.json()).status).toBe("closed");

		const reopen = await page.request.patch(
			`http://localhost:3000/api/trekking-routes/${adminRouteId}/reopen`,
			{ headers, data: { reason: "Admin sends route for approval" } }
		);
		expect(reopen.status()).toBe(200);
		expect((await reopen.json()).status).toBe("pending_approval");
		expect(
			db<{ route: { status: string } }>("get-trekking-route", { routeId: adminRouteId }).route
				.status
		).toBe("pending_approval");
	});
});

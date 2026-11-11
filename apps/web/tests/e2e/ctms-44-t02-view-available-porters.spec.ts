import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services/api");
const HOST_EMAIL = "e2e-ctms201-host@example.com";
const SUPPORT_EMAIL = "e2e-ctms201-support@example.com";
const LEAD_EMAIL = "e2e-ctms201-lead@example.com";
const FOREIGN_HOST_EMAIL = "e2e-ctms201-foreign-host@example.com";
const E2E_PASSWORD = "E2ePorter@123";

function db<T>(action: string, payload: unknown): T {
	const base64 = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(
		"node",
		["node_modules/ts-node/dist/bin.js", "src/seeds/db-helper.ts", action, base64],
		{ cwd: API_ROOT }
	).toString();
	return JSON.parse(stdout) as T;
}

function cleanUser(email: string): void {
	execFileSync(
		process.execPath,
		["node_modules/ts-node/dist/bin.js", "src/seeds/db-helper.ts", "clean-user", email],
		{ cwd: API_ROOT, stdio: "ignore" }
	);
}

async function loginHost(page: import("@playwright/test").Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(HOST_EMAIL);
	await page.locator('input[type="password"]').first().fill("Host@123");
	await page.locator('form button[type="submit"]').click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("CTMS-44-T02 View Available Porters UI", () => {
	test.describe.configure({ mode: "serial" });
	let ownedTripId = "";
	let ownedRouteId = "";
	let foreignTripId = "";
	let foreignRouteId = "";

	test.beforeAll(() => {
		for (const name of ["E2E CTMS-201 owned Route", "E2E CTMS-201 foreign Route"]) {
			const staleRoute = db<{ route: { id: string } | null }>("get-trekking-route-by-name", {
				name,
			});
			if (staleRoute.route) {
				db("clean-trekking-routes", { routeIds: [staleRoute.route.id] });
			}
		}
		for (const email of [HOST_EMAIL, SUPPORT_EMAIL, LEAD_EMAIL, FOREIGN_HOST_EMAIL])
			cleanUser(email);

		const host = db<{ id: string }>("create-account", {
			email: HOST_EMAIL,
			phone: "0912010000",
			password: "Host@123",
			role: "host",
		});
		ownedRouteId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId: host.id,
			routes: [{ name: "E2E CTMS-201 owned Route", status: "active" }],
		}).routes[0].id;

		ownedTripId = db<{ id: string }>("seed-published-trip", {
			hostId: host.id,
			routeId: ownedRouteId,
			title: "E2E CTMS-201 owned Trip",
			createdBy: host.id,
		}).id;

		db("create-account", {
			email: SUPPORT_EMAIL,
			phone: "0912010001",
			password: E2E_PASSWORD,
			role: "porter",
		});
		db("seed-available-porter", {
			porterEmail: SUPPORT_EMAIL,
			displayName: "E2E Porter Hỗ Trợ",
			experienceYears: 2,
		});

		db("create-account", {
			email: LEAD_EMAIL,
			phone: "0912010002",
			password: E2E_PASSWORD,
			role: "porter",
		});
		db("seed-available-porter", {
			porterEmail: LEAD_EMAIL,
			displayName: "E2E Porter Trưởng Đoàn",
			experienceYears: 7,
			routeId: ownedRouteId,
			proficiency: "expert",
			verifiedBy: host.id,
		});

		const foreignHost = db<{ id: string }>("create-account", {
			email: FOREIGN_HOST_EMAIL,
			phone: "0912010003",
			password: E2E_PASSWORD,
			role: "host",
		});
		foreignRouteId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId: foreignHost.id,
			routes: [{ name: "E2E CTMS-201 foreign Route", status: "active" }],
		}).routes[0].id;
		foreignTripId = db<{ id: string }>("seed-published-trip", {
			hostId: foreignHost.id,
			routeId: foreignRouteId,
			title: "E2E CTMS-201 foreign Trip",
			createdBy: foreignHost.id,
		}).id;
	});

	test.afterAll(() => {
		if (ownedTripId || foreignTripId) {
			db("clean-trips", { tripIds: [ownedTripId, foreignTripId].filter(Boolean) });
		}
		for (const email of [SUPPORT_EMAIL, LEAD_EMAIL]) cleanUser(email);
		const routeIds = [ownedRouteId, foreignRouteId].filter(Boolean);
		if (routeIds.length > 0) db("clean-trekking-routes", { routeIds });
		for (const email of [HOST_EMAIL, FOREIGN_HOST_EMAIL]) cleanUser(email);
	});

	test("Scenario 1: Host views available Porters for the selected owned Trip", async ({ page }) => {
		await loginHost(page);
		await page.goto(`/trips/${ownedTripId}`);
		await expect(page.getByTestId("available-porters-panel")).toBeVisible();
		await page.getByLabel("Vai trò Porter").selectOption("support");
		await expect(page.getByText("E2E Porter Hỗ Trợ")).toBeVisible();
		await expect(page.getByText("E2E Porter Trưởng Đoàn")).toBeVisible();
	});

	test("Scenario 2: Host applies authoritative role and experience filters", async ({ page }) => {
		await loginHost(page);
		await page.goto(`/trips/${ownedTripId}`);
		await page.getByLabel("Vai trò Porter").selectOption("support");
		await page.getByLabel("Kinh nghiệm tối thiểu (năm)").fill("5");
		await expect(page.getByText("E2E Porter Trưởng Đoàn")).toBeVisible();
		await expect(page.getByText("E2E Porter Hỗ Trợ")).toHaveCount(0);
		await page.getByLabel("Vai trò Porter").selectOption("lead");
		await expect(page.getByText("Chuyên gia")).toBeVisible();
	});

	test("Scenario 3: no backend matches produces the empty state", async ({ page }) => {
		await loginHost(page);
		await page.goto(`/trips/${ownedTripId}`);
		await page.getByLabel("Vai trò Porter").selectOption("support");
		await page.getByLabel("Kinh nghiệm tối thiểu (năm)").fill("99");
		await expect(page.getByTestId("available-porters-empty")).toContainText(
			"Không có Porter phù hợp"
		);
	});

	test("Scenario 4: a foreign Trip does not expose the Host-only candidate panel", async ({
		page,
	}) => {
		await loginHost(page);
		await page.goto(`/trips/${foreignTripId}`);
		await expect(page.getByText("E2E CTMS-201 foreign Trip")).toBeVisible();
		await expect(page.getByTestId("available-porters-panel")).toHaveCount(0);
	});

	test("Scenario 5: retry calls the authoritative backend after a retryable failure", async ({
		page,
	}) => {
		let attempts = 0;
		await page.route(`**/api/trips/${ownedTripId}/available-porters**`, async (route) => {
			attempts += 1;
			if (attempts <= 2) {
				await route.fulfill({
					status: 503,
					contentType: "application/json",
					body: '{"message":"temporary"}',
				});
				return;
			}
			await route.continue();
		});
		await loginHost(page);
		await page.goto(`/trips/${ownedTripId}`);
		await page.getByLabel("Vai trò Porter").selectOption("support");
		await page.getByRole("button", { name: "Thử lại" }).click();
		await expect(page.getByText("E2E Porter Hỗ Trợ")).toBeVisible();
		expect(attempts).toBe(3);
	});
});

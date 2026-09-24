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
 * CTMS-23-T02. Real backend/Postgres/Chrome, no mocking (mirrors
 * ctms-29-t02-weather-advice.spec.ts's own real-infra convention). Seeds a
 * Trip directly in pending_approval via a new db-helper action
 * (`seed-pending-trip`) so this suite starts straight from CTMS-023-T01's
 * one precondition -- the draft -> pending_approval submission itself is
 * CTMS-022's own already-tested Host flow, not this story's concern.
 */
test.describe("CTMS-23-T02 Approve and Publish Trip (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);
	const adminEmail = email("ctms23t02-admin");
	const hostEmail = email("ctms23t02-host");
	const camperEmail = email("ctms23t02-camper");
	const routeName = `E2E CTMS23T02 Route ${Date.now()}`;
	const approveTripTitle = `E2E CTMS23T02 Approve Trip ${Date.now()}`;
	const declineTripTitle = `E2E CTMS23T02 Decline Trip ${Date.now()}`;
	let hostId = "";
	let routeId = "";
	let approveTripId = "";
	let declineTripId = "";

	test.beforeAll(() => {
		db("create-account", {
			email: adminEmail,
			phone: phone(),
			password: PASSWORD,
			role: "admin",
			status: "active",
		});
		hostId = db<{ id: string }>("create-account", {
			email: hostEmail,
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
		routeId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId,
			routes: [{ name: routeName, status: "active" }],
		}).routes[0].id;
		approveTripId = db<{ id: string }>("seed-pending-trip", {
			hostId,
			routeId,
			title: approveTripTitle,
		}).id;
		declineTripId = db<{ id: string }>("seed-pending-trip", {
			hostId,
			routeId,
			title: declineTripTitle,
		}).id;
	});

	test.afterAll(() => {
		try {
			db("clean-trips", { tripIds: [approveTripId, declineTripId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-trekking-routes", { routeIds: [routeId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [adminEmail, hostEmail, camperEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("Admin approves a pending Trip through the UI, publishing it for real", async ({ page }) => {
		await login(page, adminEmail);
		await page.goto("/admin/trips");

		await expect(page.getByText(approveTripTitle).first()).toBeVisible();
		await page.getByLabel(`Xem xét trip ${approveTripTitle}`).click();
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Phê duyệt và xuất bản" }).click();
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		await expect(page.getByText(/Đã phê duyệt và xuất bản/).first()).toBeVisible();

		const { trip } = db<{ trip: { status: string } | null }>("get-trip", { tripId: approveTripId });
		expect(trip?.status).toBe("published");
	});

	test("Admin declines a pending Trip with a required reason, returning it to draft", async ({
		page,
	}) => {
		await login(page, adminEmail);
		await page.goto("/admin/trips");

		await expect(page.getByText(declineTripTitle).first()).toBeVisible();
		await page.getByLabel(`Xem xét trip ${declineTripTitle}`).click();
		await page.getByRole("button", { name: "Ra quyết định" }).click();
		await page.getByRole("button", { name: "Trả về bản nháp" }).click();
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		await expect(page.getByText("Lý do là bắt buộc cho quyết định này.")).toBeVisible();

		await page.getByLabel("Lý do *").fill("Thiếu mô tả điểm cắm trại qua đêm");
		await page.getByRole("button", { name: "Xác nhận quyết định" }).click();

		await expect(page.getByText(/Đã trả về bản nháp/).first()).toBeVisible();

		const { trip } = db<{ trip: { status: string } | null }>("get-trip", { tripId: declineTripId });
		expect(trip?.status).toBe("draft");
	});

	test("blocks direct navigation to the Admin trip review page for a non-admin", async ({
		page,
	}) => {
		await login(page, hostEmail);
		await page.goto("/admin/trips");

		await expect(page.getByText("403 - Hạn chế quyền truy cập")).toBeVisible();
	});
});

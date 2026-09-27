import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services", "api");
const TS_NODE_BIN = path.join(API_ROOT, "node_modules", "ts-node", "dist", "bin.js");
const DB_HELPER = path.join(API_ROOT, "src", "seeds", "db-helper.ts");
const DEV_TRIPS_SEED = path.join(API_ROOT, "src", "seeds", "dev-trips.seed.ts");
const PASSWORD = "S3curePass!";
const TRIP_TITLE = "[CTMS-024] Khám Phá Sơn Trà (Bình thường - Còn 12 chỗ)";
const LOW_CAPACITY_TRIP_TITLE = "[CTMS-024] Đỉnh Núi Bidoup Trail (Khẩn cấp: Chỉ còn 2 chỗ)";
const camperEmail = `e2e-ctms29t02-${Date.now()}@example.com`;

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, encoded], {
		cwd: API_ROOT,
	}).toString();
	return JSON.parse(stdout) as T;
}

function dbPlain(action: string, value: string): void {
	execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, value], { cwd: API_ROOT });
}

function seedBookableTrips(): void {
	execFileSync(process.execPath, [TS_NODE_BIN, DEV_TRIPS_SEED], {
		cwd: API_ROOT,
		stdio: "pipe",
	});
}

async function loginAsCamper(page: Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').fill(camperEmail);
	await page.locator('input[type="password"]').fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

test.describe("CTMS-29-T02 Create Booking for Trip", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);

	test.beforeAll(() => {
		seedBookableTrips();
		db("create-account", {
			email: camperEmail,
			phone: `09${Date.now().toString().slice(-8)}`,
			password: PASSWORD,
			role: "camper",
			status: "active",
		});
	});

	test.afterAll(() => {
		try {
			dbPlain("clean-user", camperEmail);
		} finally {
			// Restore the deterministic seat counts after the Camper's cascading Booking cleanup.
			seedBookableTrips();
		}
	});

	test("Camper creates a paid Booking and sees the authoritative result", async ({ page }) => {
		await loginAsCamper(page);
		await page.goto("/trips");

		await page.getByLabel("Tìm kiếm chuyến đi").fill("Khám Phá Sơn Trà");
		await page.getByRole("button", { name: "Tìm kiếm" }).click();
		await expect(page.getByText(TRIP_TITLE)).toBeVisible();
		await page.getByText(TRIP_TITLE).click();
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("12 chỗ");

		const participantInput = page.getByLabel("Số lượng khách", { exact: true });
		await participantInput.fill("2");
		await page.getByRole("button", { name: "Đặt chỗ ngay" }).click();

		const result = page.getByRole("status");
		await expect(result).toContainText("Đã tạo đặt chỗ thành công");
		await expect(result).toContainText("2");
		await expect(result).toContainText("pending_payment");
		await expect(result).toContainText("unpaid");
		await expect(result).toContainText("Giữ chỗ đến");
		await expect(page.getByTestId("authoritative-booking-price")).toContainText("900.000");
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("10 chỗ");
		await expect(page.getByRole("button", { name: /thanh toán/i })).toHaveCount(0);
	});

	test("shows the authoritative 409 reason when stale capacity is consumed", async ({
		context,
		page,
	}) => {
		await loginAsCamper(page);
		await page.goto("/trips");
		await page.getByLabel("Tìm kiếm chuyến đi").fill("Đỉnh Núi Bidoup Trail");
		await page.getByRole("button", { name: "Tìm kiếm" }).click();
		await expect(page.getByText(LOW_CAPACITY_TRIP_TITLE)).toBeVisible();
		await page.getByText(LOW_CAPACITY_TRIP_TITLE).click();
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("2 chỗ");

		const stalePage = await context.newPage();
		await stalePage.goto(page.url());
		await expect(stalePage.getByTestId("trip-remaining-seats")).toHaveText("2 chỗ");

		await page.getByLabel("Số lượng khách", { exact: true }).fill("2");
		await page.getByRole("button", { name: "Đặt chỗ ngay" }).click();
		await expect(page.getByRole("status")).toContainText("pending_payment");

		await stalePage.getByRole("button", { name: "Đặt chỗ ngay" }).click();
		const conflictDialog = stalePage.getByTestId("booking-conflict-dialog");
		await expect(conflictDialog).toBeVisible();
		await expect(conflictDialog).toContainText("Trip has only 0 seat(s) remaining");
	});
});

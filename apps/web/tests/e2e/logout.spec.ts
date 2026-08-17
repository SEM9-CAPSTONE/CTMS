import { execSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const API_BASE_URL = "http://localhost:3000/api";
const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const ADMIN_EMAIL = "admin@ctms.local";
const ADMIN_PASSWORD = "Admin@123";

async function loginAsAdmin(page: Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
	await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
	await page.locator('form button[type="submit"]').click();

	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("refreshToken"))).toBeTruthy();
}

test.describe("Logout UI (E2E)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(() => {
		execSync("pnpm --filter @ctms/api seed:dev-admin", {
			cwd: WORKSPACE_ROOT,
			stdio: "inherit",
		});
	});

	test("logs out from the current device, clears auth and redirects", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/dashboard");

		const logoutResponsePromise = page.waitForResponse(
			(response) =>
				response.url().includes("/api/auth/logout") && response.request().method() === "POST"
		);

		await page
			.getByRole("button", {
				name: /đăng xuất thiết bị này/i,
			})
			.click();

		const logoutResponse = await logoutResponsePromise;

		expect(logoutResponse.status()).toBe(200);

		await expect(page).toHaveURL(/\/login$/);

		await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();

		await expect.poll(() => page.evaluate(() => localStorage.getItem("refreshToken"))).toBeNull();

		await expect.poll(() => page.evaluate(() => localStorage.getItem("authUser"))).toBeNull();
	});

	test("requires confirmation before logout from all devices", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/dashboard");

		await page.getByRole("button", { name: /đăng xuất tất cả thiết bị/i }).click();

		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.getByText(/bạn sẽ phải đăng nhập lại trên tất cả thiết bị/i)).toBeVisible();

		expect(await page.evaluate(() => localStorage.getItem("refreshToken"))).toBeTruthy();

		await page.getByRole("button", { name: /hủy/i }).click();
		await expect(page.getByRole("dialog")).not.toBeVisible();
	});

	test("logs out from all devices after confirmation", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/dashboard");

		await page.getByRole("button", { name: /đăng xuất tất cả thiết bị/i }).click();
		await page.getByRole("button", { name: /xác nhận/i }).click();

		await expect(page).toHaveURL(/\/login$/);
		await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();
		await expect.poll(() => page.evaluate(() => localStorage.getItem("refreshToken"))).toBeNull();
		await expect.poll(() => page.evaluate(() => localStorage.getItem("authUser"))).toBeNull();
	});

	test("keeps local session and shows an error when logout API fails", async ({ page }) => {
		await loginAsAdmin(page);
		await page.goto("/dashboard");

		const accessBefore = await page.evaluate(() => localStorage.getItem("accessToken"));
		const refreshBefore = await page.evaluate(() => localStorage.getItem("refreshToken"));
		const userBefore = await page.evaluate(() => localStorage.getItem("authUser"));

		await page.route("**/api/auth/logout", async (route) => {
			await route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					statusCode: 500,
					message: "Internal server error",
				}),
			});
		});

		await page.getByRole("button", { name: /đăng xuất thiết bị này/i }).click();

		await expect(page.getByRole("alert")).toContainText(/không thể đăng xuất/i);
		await expect(page).toHaveURL(/\/dashboard$/);

		expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBe(accessBefore);
		expect(await page.evaluate(() => localStorage.getItem("refreshToken"))).toBe(refreshBefore);
		expect(await page.evaluate(() => localStorage.getItem("authUser"))).toBe(userBefore);
	});

	test("revoked refresh token cannot refresh after current-device logout", async ({
		page,
		request,
	}) => {
		await loginAsAdmin(page);
		await page.goto("/dashboard");

		const oldRefreshToken = await page.evaluate(() => localStorage.getItem("refreshToken"));
		expect(oldRefreshToken).toBeTruthy();

		await page.getByRole("button", { name: /đăng xuất thiết bị này/i }).click();

		await expect(page).toHaveURL(/\/login$/);

		const response = await request.post(`${API_BASE_URL}/auth/refresh`, {
			data: { refreshToken: oldRefreshToken },
		});

		expect(response.status()).toBe(401);
	});
});

import { execSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

// Matches httpClient.ts's own default (VITE_API_BASE_URL fallback). E2E
// setup calls the backend directly to create fixtures the UI can't (a
// pending_verification account), the same way register.spec.ts drives state
// through the real API rather than seeding the database directly.
const API_BASE_URL = "http://localhost:3000/api";
const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

function uniqueEmail(tag: string): string {
	return `e2e-login-${tag}-${Date.now()}@example.com`;
}

function uniqueLocalPhone(): string {
	const timestampPart = Date.now().toString().slice(-3);
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `09${timestampPart}${randomPart}`;
}

async function fillAndSubmit(page: Page, identifier: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(identifier);
	await page.locator('input[type="password"]').first().fill(password);
	await page.locator('form button[type="submit"]').click();
}

test.describe("Login (E2E, real backend)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(() => {
		execSync("pnpm --filter @ctms/api seed:dev-admin", {
			cwd: WORKSPACE_ROOT,
			stdio: "inherit",
		});
	});

	// E2E-TC1: Logs in successfully with the dev-only seed admin account
	// (admin@ctms.local / Admin@123, chore(CTMS-03): dev-only seed admin).
	test("logs in successfully with the seed admin account", async ({ page }) => {
		await fillAndSubmit(page, "admin@ctms.local", "Admin@123");

		await expect
			.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
			.toBeTruthy();
		await expect
			.poll(() => page.evaluate(() => window.localStorage.getItem("refreshToken")))
			.toBeTruthy();
		await expect(page).toHaveURL(/\/admin\/users$/);
	});

	// E2E-TC2: Wrong password (401 Invalid credentials, mapped to Vietnamese copy)
	test("rejects a wrong password with a Vietnamese error message", async ({ page }) => {
		await fillAndSubmit(page, "admin@ctms.local", "WrongPassword1");

		await expect(page.getByRole("alert")).toContainText(/không chính xác/i);
	});

	// E2E-TC3: Account not yet verified (401 Account is not active). A fresh
	// account is created through the real register API (status defaults to
	// pending_verification), then login is attempted through the real UI.
	test("rejects a not-yet-active account with a Vietnamese error message", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("tc3");
		const password = "Verify@123";

		const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
			data: {
				email,
				phone: uniqueLocalPhone(),
				password,
				role: "camper",
			},
		});
		expect(registerResponse.ok()).toBe(true);

		await fillAndSubmit(page, email, password);

		await expect(page.getByRole("alert")).toContainText(/chưa được kích hoạt/i);
	});
});

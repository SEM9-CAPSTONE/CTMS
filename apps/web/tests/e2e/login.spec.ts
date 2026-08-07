import { type Page, expect, test } from "@playwright/test";

// Matches httpClient.ts's own default (VITE_API_BASE_URL fallback) — E2E
// setup calls the backend directly to create fixtures the UI can't (a
// pending_verification account), the same way register.spec.ts drives state
// through the real API rather than seeding the database directly.
const API_BASE_URL = "http://localhost:3000/api";

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
	await page.getByPlaceholder("your@email.com hoặc 09xxxxxxxx").fill(identifier);
	await page.getByPlaceholder("••••••••").fill(password);
	await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test.describe("Login (E2E, real backend)", () => {
	// E2E-TC1 — Logs in successfully with the dev-only seed admin account
	// (admin@ctms.local / Admin@123 — chore(CTMS-03): dev-only seed admin).
	test("logs in successfully with the seed admin account", async ({ page }) => {
		await fillAndSubmit(page, "admin@ctms.local", "Admin@123");

		await expect(page.getByText(/đăng nhập thành công/i)).toBeVisible();
	});

	// E2E-TC2 — Wrong password (401 Invalid credentials, mapped to Vietnamese copy)
	test("rejects a wrong password with a Vietnamese error message", async ({ page }) => {
		await fillAndSubmit(page, "admin@ctms.local", "WrongPassword1");

		await expect(
			page.getByText("Email/số điện thoại hoặc mật khẩu không chính xác.")
		).toBeVisible();
	});

	// E2E-TC3 — Account not yet verified (401 Account is not active). A fresh
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

		await expect(
			page.getByText(
				"Tài khoản của bạn chưa được kích hoạt. Vui lòng xác minh tài khoản trước khi đăng nhập."
			)
		).toBeVisible();
	});
});

import { type Page, expect, test } from "@playwright/test";

const PASSWORD = "S3curePass!";

function uniqueEmail(tag: string): string {
	return `e2e-${tag}-${Date.now()}@example.com`;
}

function uniqueLocalPhone(): string {
	// "09" + 8 digits combining timestamp + randomness -> a valid-format VN
	// mobile number (^0(3|5|7|8|9)\d{8}$) per call. Timestamp alone (ms
	// resolution) is not unique enough now that phone is required in every
	// test and Playwright runs tests in parallel workers — two calls can land
	// on the same millisecond and collide. A random component makes that
	// collision negligible, matching how uniqueEmail() below stays unique.
	const timestampPart = Date.now().toString().slice(-3);
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `09${timestampPart}${randomPart}`;
}

async function goToRegisterStep2(page: Page): Promise<void> {
	await page.goto("/register");
	await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
}

async function fillRequiredCommonFields(page: Page): Promise<void> {
	await page.getByPlaceholder("Nguyễn Văn A").fill("E2E Test User");
	const passwordInputs = page.getByPlaceholder("••••••••");
	await passwordInputs.nth(0).fill(PASSWORD);
	await passwordInputs.nth(1).fill(PASSWORD);
}

function submitButton(page: Page) {
	return page.getByRole("button", { name: "Đăng ký ngay" });
}

test.describe("Register (E2E, real backend)", () => {
	// E2E-TC1 — Register successfully with email and phone (both mandatory —
	// business flow update). The previous separate "email only" / "phone
	// only" happy-path tests are no longer reachable: the email and phone
	// inputs are both `required`, so a real browser blocks submission when
	// either is empty, before the request ever reaches the backend.
	test("registers successfully with email and phone", async ({ page }) => {
		await goToRegisterStep2(page);
		await fillRequiredCommonFields(page);
		await page.getByPlaceholder("camper@example.com").fill(uniqueEmail("tc1"));
		await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());

		await submitButton(page).click();

		await expect(page.getByText("Đăng ký tài khoản thành công!")).toBeVisible();
	});

	// E2E-TC2 — Duplicate account (409)
	test("rejects a duplicate email with 409 and keeps the entered data", async ({ page }) => {
		const email = uniqueEmail("tc2");

		// First registration — establishes the "already exists" precondition
		// through the real UI + real API, not by seeding the database.
		await goToRegisterStep2(page);
		await fillRequiredCommonFields(page);
		await page.getByPlaceholder("camper@example.com").fill(email);
		await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
		await submitButton(page).click();
		await expect(page.getByText("Đăng ký tài khoản thành công!")).toBeVisible();

		// Second registration attempt with the same email (fresh phone, so the
		// 409 is attributable only to the duplicated email).
		await goToRegisterStep2(page);
		await fillRequiredCommonFields(page);
		const emailInput = page.getByPlaceholder("camper@example.com");
		await emailInput.fill(email);
		await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
		await submitButton(page).click();

		await expect(page.getByText("Email or phone already registered")).toBeVisible();
		await expect(emailInput).toHaveValue(email);
	});
});

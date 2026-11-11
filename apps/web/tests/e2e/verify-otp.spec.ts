import { type Page, expect, test } from "@playwright/test";

const PASSWORD = "S3curePass!";

function uniqueEmail(tag: string): string {
	// Timestamp alone (ms resolution) collides when two tests in this file
	// call registerAndReachVerifyOtp() with the same tag in parallel workers
	// within the same millisecond (observed once in a real run) — a random
	// component makes that collision negligible, matching uniqueLocalPhone().
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `e2e-${tag}-${Date.now()}-${randomPart}@example.com`;
}

function uniqueLocalPhone(): string {
	// Same collision-avoidance approach as register.spec.ts's helper.
	const timestampPart = Date.now().toString().slice(-3);
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `09${timestampPart}${randomPart}`;
}

/** Registers a fresh account through the real UI and lands on /verify-otp. */
async function registerAndReachVerifyOtp(page: Page): Promise<void> {
	await page.goto("/register");
	await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
	await page.getByPlaceholder("Nguyễn Văn A").fill("E2E Verify User");
	const passwordInputs = page.getByPlaceholder("••••••••");
	await passwordInputs.nth(0).fill(PASSWORD);
	await passwordInputs.nth(1).fill(PASSWORD);
	await page.getByPlaceholder("camper@example.com").fill(uniqueEmail("verify"));
	await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
	await page.getByRole("button", { name: "Đăng ký ngay" }).click();
	await expect(page).toHaveURL(/\/verify-otp$/);
}

async function mockOtpSendSuccess(page: Page): Promise<void> {
	await page.route("**/api/auth/send-otp", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ id: "e2e-user", status: "pending_verification" }),
		});
	});
	await page.route("**/api/auth/resend", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ id: "e2e-user", status: "pending_verification" }),
		});
	});
}

async function mockIncorrectOtp(page: Page): Promise<void> {
	await page.route("**/api/auth/verify", async (route) => {
		await route.fulfill({
			status: 409,
			contentType: "application/json",
			body: JSON.stringify({
				statusCode: 409,
				message: "Incorrect OTP",
				error: "Conflict",
			}),
		});
	});
}

function sendCodeButton(page: Page) {
	return page.getByRole("button", { name: /gửi mã otp|gửi lại mã/i });
}

function phoneChannelButton(page: Page) {
	return page.getByRole("button", { name: /xác minh qua sđt/i });
}

function otpInput(page: Page) {
	return page.getByLabel("Mã OTP *");
}

function verifyButton(page: Page) {
	// exact: true -- a substring match also hits the channel selector buttons
	// ("Xác minh qua SĐT" / "Xác minh qua Email").
	return page.getByRole("button", { name: "Xác minh", exact: true });
}

test.describe("Verify OTP (E2E, real backend)", () => {
	// E2E-TC1 — Direct visit without a prior register (no sessionStorage
	// context) redirects back to RegisterPage (Phase 2 Decision Gate).
	test("redirects to Register when visited directly without a registration context", async ({
		page,
	}) => {
		await page.goto("/verify-otp");

		await expect(page).toHaveURL(/\/register$/);
	});

	// E2E-TC2 — First OTP Trigger Decision Gate (Option B): no OTP is ever
	// sent automatically on page load; the send button stays disabled until a
	// verification method is chosen, and the OTP input only becomes usable
	// after the user presses "Gửi mã OTP".
	test("keeps the send button disabled until a channel is chosen, then keeps the OTP input disabled until sent", async ({
		page,
	}) => {
		await mockOtpSendSuccess(page);
		await registerAndReachVerifyOtp(page);

		await expect(otpInput(page)).toBeDisabled();
		await expect(verifyButton(page)).toBeDisabled();
		await expect(sendCodeButton(page)).toBeDisabled();
		await expect(sendCodeButton(page)).toHaveText("Gửi mã OTP");

		await phoneChannelButton(page).click();
		await expect(sendCodeButton(page)).toBeEnabled();

		await sendCodeButton(page).click();

		await expect(otpInput(page)).toBeEnabled();
		await expect(sendCodeButton(page)).toBeDisabled();
		await expect(sendCodeButton(page)).toHaveText(/gửi lại mã \(\d+s\)/i);
	});

	// E2E-TC3 — Wrong OTP (409, AC3): entering an incorrect code shows the
	// backend's error and does not navigate away. The real OTP value is never
	// exposed by any API response (by design), so a full "correct OTP"
	// success path is not reachable from pure browser E2E — that path is
	// already covered end-to-end against a real Postgres by the backend's own
	// integration suite (services/api/test/auth.verify-otp.integration-spec.ts
	// and auth.send-otp.integration-spec.ts), which can read the raw code
	// in-process via authService.issueOtp().
	test("shows the incorrect-OTP error and stays on the page for a wrong code", async ({ page }) => {
		await mockOtpSendSuccess(page);
		await mockIncorrectOtp(page);
		await registerAndReachVerifyOtp(page);
		await phoneChannelButton(page).click();
		await sendCodeButton(page).click();
		await expect(otpInput(page)).toBeEnabled();

		await otpInput(page).fill("000000");
		await verifyButton(page).click();

		await expect(page.getByText("Incorrect OTP")).toBeVisible();
		await expect(page).toHaveURL(/\/verify-otp$/);
	});
});

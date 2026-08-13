# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify-otp.spec.ts >> Verify OTP (E2E, real backend) >> shows the incorrect-OTP error and stays on the page for a wrong code
- Location: tests\e2e\verify-otp.spec.ts:132:2

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/verify-otp$/
Received string:  "http://localhost:5174/register"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://localhost:5174/register"

```

```yaml
- heading "Tham gia CTMS" [level=1]
- text: 1 Chọn vai trò 2 Nhập thông tin 3 Xác minh OTP
- heading "Tài khoản Camper (Khách cắm trại)" [level=2]
- paragraph: Vui lòng hoàn tất các thông tin theo yêu cầu nghiệp vụ.
- text: camper Họ và tên *
- img
- textbox "Nguyễn Văn A": E2E Verify User
- text: Email *
- img
- textbox "camper@example.com": e2e-verify-1786618581817-50350@example.com
- text: Số điện thoại *
- img
- textbox "0912345678": "0984270138"
- text: Nhóm máu (Safety Profile)
- img
- combobox:
  - option "Nhóm O" [selected]
  - option "Nhóm A"
  - option "Nhóm B"
  - option "Nhóm AB"
- text: Thể lực trekking
- img
- combobox:
  - option "Mới bắt đầu (Cơ bản)"
  - option "Trung bình (Trekking nhẹ)" [selected]
  - option "Nâng cao (Leo núi nhiều ngày)"
- text: SĐT Người thân khẩn cấp
- img
- textbox "0987654321"
- text: Mật khẩu *
- img
- textbox "••••••••": S3curePass!
- text: Xác nhận mật khẩu *
- img
- textbox "••••••••": S3curePass!
- paragraph: Failed to fetch
- button "Chọn lại vai trò":
  - img
  - text: Chọn lại vai trò
- button "Đăng ký ngay":
  - text: Đăng ký ngay
  - img
- text: Bạn đã có tài khoản?
- button "Đăng nhập ngay"
- button "Trang chủ":
  - img
  - text: Trang chủ
- link "Trợ giúp":
  - /url: "#help"
  - img
  - text: Trợ giúp
```

# Test source

```ts
  1   | import { type Page, expect, test } from "@playwright/test";
  2   | 
  3   | const PASSWORD = "S3curePass!";
  4   | 
  5   | function uniqueEmail(tag: string): string {
  6   | 	// Timestamp alone (ms resolution) collides when two tests in this file
  7   | 	// call registerAndReachVerifyOtp() with the same tag in parallel workers
  8   | 	// within the same millisecond (observed once in a real run) — a random
  9   | 	// component makes that collision negligible, matching uniqueLocalPhone().
  10  | 	const randomPart = Math.floor(Math.random() * 100000)
  11  | 		.toString()
  12  | 		.padStart(5, "0");
  13  | 	return `e2e-${tag}-${Date.now()}-${randomPart}@example.com`;
  14  | }
  15  | 
  16  | function uniqueLocalPhone(): string {
  17  | 	// Same collision-avoidance approach as register.spec.ts's helper.
  18  | 	const timestampPart = Date.now().toString().slice(-3);
  19  | 	const randomPart = Math.floor(Math.random() * 100000)
  20  | 		.toString()
  21  | 		.padStart(5, "0");
  22  | 	return `09${timestampPart}${randomPart}`;
  23  | }
  24  | 
  25  | /** Registers a fresh account through the real UI and lands on /verify-otp. */
  26  | async function registerAndReachVerifyOtp(page: Page): Promise<void> {
  27  | 	await page.goto("/register");
  28  | 	await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
  29  | 	await page.getByPlaceholder("Nguyễn Văn A").fill("E2E Verify User");
  30  | 	const passwordInputs = page.getByPlaceholder("••••••••");
  31  | 	await passwordInputs.nth(0).fill(PASSWORD);
  32  | 	await passwordInputs.nth(1).fill(PASSWORD);
  33  | 	await page.getByPlaceholder("camper@example.com").fill(uniqueEmail("verify"));
  34  | 	await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
  35  | 	await page.getByRole("button", { name: "Đăng ký ngay" }).click();
> 36  | 	await expect(page).toHaveURL(/\/verify-otp$/);
      |                     ^ Error: expect(page).toHaveURL(expected) failed
  37  | }
  38  | 
  39  | async function mockOtpSendSuccess(page: Page): Promise<void> {
  40  | 	await page.route("**/api/auth/send-otp", async (route) => {
  41  | 		await route.fulfill({
  42  | 			status: 200,
  43  | 			contentType: "application/json",
  44  | 			body: JSON.stringify({ id: "e2e-user", status: "pending_verification" }),
  45  | 		});
  46  | 	});
  47  | 	await page.route("**/api/auth/resend", async (route) => {
  48  | 		await route.fulfill({
  49  | 			status: 200,
  50  | 			contentType: "application/json",
  51  | 			body: JSON.stringify({ id: "e2e-user", status: "pending_verification" }),
  52  | 		});
  53  | 	});
  54  | }
  55  | 
  56  | async function mockIncorrectOtp(page: Page): Promise<void> {
  57  | 	await page.route("**/api/auth/verify", async (route) => {
  58  | 		await route.fulfill({
  59  | 			status: 409,
  60  | 			contentType: "application/json",
  61  | 			body: JSON.stringify({
  62  | 				statusCode: 409,
  63  | 				message: "Incorrect OTP",
  64  | 				error: "Conflict",
  65  | 			}),
  66  | 		});
  67  | 	});
  68  | }
  69  | 
  70  | function sendCodeButton(page: Page) {
  71  | 	return page.getByRole("button", { name: /gửi mã otp|gửi lại mã/i });
  72  | }
  73  | 
  74  | function phoneChannelButton(page: Page) {
  75  | 	return page.getByRole("button", { name: /xác minh qua sđt/i });
  76  | }
  77  | 
  78  | function otpInput(page: Page) {
  79  | 	return page.getByLabel("Mã OTP *");
  80  | }
  81  | 
  82  | function verifyButton(page: Page) {
  83  | 	// exact: true -- a substring match also hits the channel selector buttons
  84  | 	// ("Xác minh qua SĐT" / "Xác minh qua Email").
  85  | 	return page.getByRole("button", { name: "Xác minh", exact: true });
  86  | }
  87  | 
  88  | test.describe("Verify OTP (E2E, real backend)", () => {
  89  | 	// E2E-TC1 — Direct visit without a prior register (no sessionStorage
  90  | 	// context) redirects back to RegisterPage (Phase 2 Decision Gate).
  91  | 	test("redirects to Register when visited directly without a registration context", async ({
  92  | 		page,
  93  | 	}) => {
  94  | 		await page.goto("/verify-otp");
  95  | 
  96  | 		await expect(page).toHaveURL(/\/register$/);
  97  | 	});
  98  | 
  99  | 	// E2E-TC2 — First OTP Trigger Decision Gate (Option B): no OTP is ever
  100 | 	// sent automatically on page load; the send button stays disabled until a
  101 | 	// verification method is chosen, and the OTP input only becomes usable
  102 | 	// after the user presses "Gửi mã OTP".
  103 | 	test("keeps the send button disabled until a channel is chosen, then keeps the OTP input disabled until sent", async ({
  104 | 		page,
  105 | 	}) => {
  106 | 		await mockOtpSendSuccess(page);
  107 | 		await registerAndReachVerifyOtp(page);
  108 | 
  109 | 		await expect(otpInput(page)).toBeDisabled();
  110 | 		await expect(verifyButton(page)).toBeDisabled();
  111 | 		await expect(sendCodeButton(page)).toBeDisabled();
  112 | 		await expect(sendCodeButton(page)).toHaveText("Gửi mã OTP");
  113 | 
  114 | 		await phoneChannelButton(page).click();
  115 | 		await expect(sendCodeButton(page)).toBeEnabled();
  116 | 
  117 | 		await sendCodeButton(page).click();
  118 | 
  119 | 		await expect(otpInput(page)).toBeEnabled();
  120 | 		await expect(sendCodeButton(page)).toBeDisabled();
  121 | 		await expect(sendCodeButton(page)).toHaveText(/gửi lại mã \(\d+s\)/i);
  122 | 	});
  123 | 
  124 | 	// E2E-TC3 — Wrong OTP (409, AC3): entering an incorrect code shows the
  125 | 	// backend's error and does not navigate away. The real OTP value is never
  126 | 	// exposed by any API response (by design), so a full "correct OTP"
  127 | 	// success path is not reachable from pure browser E2E — that path is
  128 | 	// already covered end-to-end against a real Postgres by the backend's own
  129 | 	// integration suite (services/api/test/auth.verify-otp.integration-spec.ts
  130 | 	// and auth.send-otp.integration-spec.ts), which can read the raw code
  131 | 	// in-process via authService.issueOtp().
  132 | 	test("shows the incorrect-OTP error and stays on the page for a wrong code", async ({ page }) => {
  133 | 		await mockOtpSendSuccess(page);
  134 | 		await mockIncorrectOtp(page);
  135 | 		await registerAndReachVerifyOtp(page);
  136 | 		await phoneChannelButton(page).click();
```
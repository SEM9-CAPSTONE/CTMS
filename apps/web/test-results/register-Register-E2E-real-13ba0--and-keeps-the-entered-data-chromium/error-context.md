# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register.spec.ts >> Register (E2E, real backend) >> rejects a duplicate email with 409 and keeps the entered data
- Location: tests\e2e\register.spec.ts:63:2

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/verify-otp$/
Received string:  "http://localhost:5174/register"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://localhost:5174/register"

```

```yaml
- heading "Tham gia CTMS" [level=1]
- text: 1 Chọn vai trò 2 Nhập thông tin 3 Xác minh OTP
- heading "Tài khoản Camper (Khách cắm trại)" [level=2]
- paragraph: Vui lòng hoàn tất các thông tin theo yêu cầu nghiệp vụ.
- text: camper Họ và tên *
- img
- textbox "Nguyễn Văn A": E2E Test User
- text: Email *
- img
- textbox "camper@example.com": e2e-tc2-1786618578134@example.com
- text: Số điện thoại *
- img
- textbox "0912345678": "0955131707"
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
  1  | import { type Page, expect, test } from "@playwright/test";
  2  | 
  3  | const PASSWORD = "S3curePass!";
  4  | 
  5  | function uniqueEmail(tag: string): string {
  6  | 	return `e2e-${tag}-${Date.now()}@example.com`;
  7  | }
  8  | 
  9  | function uniqueLocalPhone(): string {
  10 | 	// "09" + 8 digits combining timestamp + randomness -> a valid-format VN
  11 | 	// mobile number (^0(3|5|7|8|9)\d{8}$) per call. Timestamp alone (ms
  12 | 	// resolution) is not unique enough now that phone is required in every
  13 | 	// test and Playwright runs tests in parallel workers — two calls can land
  14 | 	// on the same millisecond and collide. A random component makes that
  15 | 	// collision negligible, matching how uniqueEmail() below stays unique.
  16 | 	const timestampPart = Date.now().toString().slice(-3);
  17 | 	const randomPart = Math.floor(Math.random() * 100000)
  18 | 		.toString()
  19 | 		.padStart(5, "0");
  20 | 	return `09${timestampPart}${randomPart}`;
  21 | }
  22 | 
  23 | async function goToRegisterStep2(page: Page): Promise<void> {
  24 | 	await page.goto("/register");
  25 | 	await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
  26 | }
  27 | 
  28 | async function fillRequiredCommonFields(page: Page): Promise<void> {
  29 | 	await page.getByPlaceholder("Nguyễn Văn A").fill("E2E Test User");
  30 | 	const passwordInputs = page.getByPlaceholder("••••••••");
  31 | 	await passwordInputs.nth(0).fill(PASSWORD);
  32 | 	await passwordInputs.nth(1).fill(PASSWORD);
  33 | }
  34 | 
  35 | function submitButton(page: Page) {
  36 | 	return page.getByRole("button", { name: "Đăng ký ngay" });
  37 | }
  38 | 
  39 | test.describe("Register (E2E, real backend)", () => {
  40 | 	// E2E-TC1 — Register successfully with email and phone (both mandatory —
  41 | 	// business flow update). The previous separate "email only" / "phone
  42 | 	// only" happy-path tests are no longer reachable: the email and phone
  43 | 	// inputs are both `required`, so a real browser blocks submission when
  44 | 	// either is empty, before the request ever reaches the backend.
  45 | 	//
  46 | 	// Success now navigates to /verify-otp (CTMS-02-T02) instead of showing a
  47 | 	// static success screen on /register.
  48 | 	test("registers successfully with email and phone and navigates to Verify OTP", async ({
  49 | 		page,
  50 | 	}) => {
  51 | 		await goToRegisterStep2(page);
  52 | 		await fillRequiredCommonFields(page);
  53 | 		await page.getByPlaceholder("camper@example.com").fill(uniqueEmail("tc1"));
  54 | 		await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
  55 | 
  56 | 		await submitButton(page).click();
  57 | 
  58 | 		await expect(page).toHaveURL(/\/verify-otp$/);
  59 | 		await expect(page.getByText("Xác minh tài khoản")).toBeVisible();
  60 | 	});
  61 | 
  62 | 	// E2E-TC2 — Duplicate account (409)
  63 | 	test("rejects a duplicate email with 409 and keeps the entered data", async ({ page }) => {
  64 | 		const email = uniqueEmail("tc2");
  65 | 
  66 | 		// First registration — establishes the "already exists" precondition
  67 | 		// through the real UI + real API, not by seeding the database.
  68 | 		await goToRegisterStep2(page);
  69 | 		await fillRequiredCommonFields(page);
  70 | 		await page.getByPlaceholder("camper@example.com").fill(email);
  71 | 		await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
  72 | 		await submitButton(page).click();
> 73 | 		await expect(page).toHaveURL(/\/verify-otp$/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  74 | 
  75 | 		// Second registration attempt with the same email (fresh phone, so the
  76 | 		// 409 is attributable only to the duplicated email).
  77 | 		await goToRegisterStep2(page);
  78 | 		await fillRequiredCommonFields(page);
  79 | 		const emailInput = page.getByPlaceholder("camper@example.com");
  80 | 		await emailInput.fill(email);
  81 | 		await page.getByPlaceholder("0912345678").fill(uniqueLocalPhone());
  82 | 		await submitButton(page).click();
  83 | 
  84 | 		await expect(page.getByText("Email or phone already registered")).toBeVisible();
  85 | 		await expect(emailInput).toHaveValue(email);
  86 | 	});
  87 | });
  88 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: audit-logs.spec.ts >> Record Audit Logs for Critical Actions (E2E, real backend) >> performs register -> verify otp -> login and asserts audit logs in DB
- Location: tests\e2e\audit-logs.spec.ts:76:2

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
- textbox "Nguyễn Văn A": Audit E2E User
- text: Email *
- img
- textbox "camper@example.com": e2e-audit-tc-1786618537512-22606@example.com
- text: Số điện thoại *
- img
- textbox "0912345678": "0951215154"
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
  2   | import path from "node:path";
  3   | import { expect, test } from "@playwright/test";
  4   | 
  5   | const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
  6   | 
  7   | function uniqueEmail(tag: string): string {
  8   | 	const randomPart = Math.floor(Math.random() * 100000)
  9   | 		.toString()
  10  | 		.padStart(5, "0");
  11  | 	return `e2e-audit-${tag}-${Date.now()}-${randomPart}@example.com`;
  12  | }
  13  | 
  14  | function uniqueLocalPhone(): string {
  15  | 	const timestampPart = Date.now().toString().slice(-3);
  16  | 	const randomPart = Math.floor(Math.random() * 100000)
  17  | 		.toString()
  18  | 		.padStart(5, "0");
  19  | 	return `09${timestampPart}${randomPart}`;
  20  | }
  21  | 
  22  | interface E2EAuditLog {
  23  | 	actorId: string | null;
  24  | 	action: string;
  25  | 	targetType: string;
  26  | 	targetId: string;
  27  | 	before: Record<string, unknown> | null;
  28  | 	after: Record<string, unknown> | null;
  29  | 	reason: string | null;
  30  | 	createdAt: string;
  31  | }
  32  | 
  33  | interface E2EUser {
  34  | 	id: string;
  35  | 	email: string;
  36  | 	phone: string;
  37  | 	status: string;
  38  | 	role: string;
  39  | }
  40  | 
  41  | interface DbHelperUserResult {
  42  | 	user: E2EUser | null;
  43  | 	hasOtp: boolean;
  44  | }
  45  | 
  46  | interface DbHelperOtpResult {
  47  | 	otp: string;
  48  | }
  49  | 
  50  | interface DbHelperLogsResult {
  51  | 	logs: E2EAuditLog[];
  52  | }
  53  | 
  54  | function runDbHelper(action: string, arg: string): Record<string, unknown> {
  55  | 	const cmd = `pnpm --filter @ctms/api exec ts-node src/seeds/db-helper.ts ${action} ${arg}`;
  56  | 	const stdout = execSync(cmd, { cwd: WORKSPACE_ROOT }).toString();
  57  | 	return JSON.parse(stdout) as Record<string, unknown>;
  58  | }
  59  | 
  60  | test.describe("Record Audit Logs for Critical Actions (E2E, real backend)", () => {
  61  | 	test.describe.configure({ mode: "serial" });
  62  | 	test.setTimeout(60_000);
  63  | 
  64  | 	const email = uniqueEmail("tc");
  65  | 	const phone = uniqueLocalPhone();
  66  | 	const password = "S3curePass!";
  67  | 
  68  | 	test.afterAll(() => {
  69  | 		try {
  70  | 			runDbHelper("clean-user", email);
  71  | 		} catch (e) {
  72  | 			console.error("Cleanup failed:", e);
  73  | 		}
  74  | 	});
  75  | 
  76  | 	test("performs register -> verify otp -> login and asserts audit logs in DB", async ({
  77  | 		page,
  78  | 	}) => {
  79  | 		// Intercept SMS/Email delivery requests on the frontend to prevent failing
  80  | 		// due to unconfigured/mock external services (Twilio, SMTP).
  81  | 		// We will generate the actual database OTP record via runDbHelper below.
  82  | 		await page.route("**/api/auth/send-otp", async (route) => {
  83  | 			await route.fulfill({
  84  | 				status: 200,
  85  | 				contentType: "application/json",
  86  | 				body: JSON.stringify({ id: "mock-otp-id", status: "pending_verification" }),
  87  | 			});
  88  | 		});
  89  | 
  90  | 		// 1. Register Camper via UI
  91  | 		await page.goto("/register");
  92  | 		await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
  93  | 		await page.getByPlaceholder("Nguyễn Văn A").fill("Audit E2E User");
  94  | 		const passwordInputs = page.getByPlaceholder("••••••••");
  95  | 		await passwordInputs.nth(0).fill(password);
  96  | 		await passwordInputs.nth(1).fill(password);
  97  | 		await page.getByPlaceholder("camper@example.com").fill(email);
  98  | 		await page.getByPlaceholder("0912345678").fill(phone);
  99  | 		await page.getByRole("button", { name: "Đăng ký ngay" }).click();
  100 | 
  101 | 		// Verify navigates to verify-otp
> 102 | 		await expect(page).toHaveURL(/\/verify-otp$/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  103 | 		await expect(page.getByText("Xác minh tài khoản")).toBeVisible();
  104 | 
  105 | 		// Verify user row is created on backend and audit log 'auth.register' is written
  106 | 		const userResult = runDbHelper("get-user", email) as unknown as DbHelperUserResult;
  107 | 		expect(userResult.user).toBeDefined();
  108 | 		if (!userResult.user) throw new Error("User not found in DB");
  109 | 		expect(userResult.user.status).toBe("pending_verification");
  110 | 		const userId = userResult.user.id;
  111 | 
  112 | 		const registerLogsResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
  113 | 		const registerLog = registerLogsResult.logs.find((l) => l.action === "auth.register");
  114 | 		expect(registerLog).toBeDefined();
  115 | 		if (!registerLog) throw new Error("Register log not found");
  116 | 		expect(registerLog.actorId).toBe(userId);
  117 | 		expect(registerLog.targetType).toBe("user");
  118 | 		expect(registerLog.targetId).toBe(userId);
  119 | 		expect(registerLog.before).toBeNull();
  120 | 		expect(registerLog.after).toEqual({ role: "camper" });
  121 | 
  122 | 		// 2. Select Verification Channel & request OTP via UI. The channel
  123 | 		// card has transition classes and can remain "unstable" in Chromium
  124 | 		// actionability checks even after it is visible and enabled, so keep the
  125 | 		// selector user-facing but bypass the stability wait for this click only.
  126 | 		const phoneChannelButton = page.getByRole("button", { name: "Xác minh qua SĐT" });
  127 | 		await phoneChannelButton.scrollIntoViewIfNeeded();
  128 | 		await expect(phoneChannelButton).toBeEnabled();
  129 | 		await phoneChannelButton.click({ force: true });
  130 | 		await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  131 | 
  132 | 		// Fetch issued OTP code from DB
  133 | 		const otpResult = runDbHelper("get-otp", email) as unknown as DbHelperOtpResult;
  134 | 		const otpCode = otpResult.otp;
  135 | 		expect(otpCode).toBeDefined();
  136 | 
  137 | 		// Fill OTP and click verify
  138 | 		await page.getByLabel("Mã OTP *").fill(otpCode);
  139 | 		await page.getByRole("button", { name: "Xác minh", exact: true }).click();
  140 | 
  141 | 		// Success screen
  142 | 		await expect(page.getByText("Xác thực thành công!")).toBeVisible();
  143 | 		await page.getByRole("button", { name: "Đến trang đăng nhập ngay" }).click();
  144 | 		await expect(page).toHaveURL(/\/login$/);
  145 | 
  146 | 		// Verify user status is now active and verification OTP row is deleted
  147 | 		const postVerifyUser = runDbHelper("get-user", email) as unknown as DbHelperUserResult;
  148 | 		expect(postVerifyUser.user).toBeDefined();
  149 | 		if (!postVerifyUser.user) throw new Error("User not found after verification");
  150 | 		expect(postVerifyUser.user.status).toBe("active");
  151 | 		expect(postVerifyUser.hasOtp).toBe(false);
  152 | 
  153 | 		// Verify audit log 'auth.verify_otp' is written
  154 | 		const verifyLogsResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
  155 | 		const verifyLog = verifyLogsResult.logs.find((l) => l.action === "auth.verify_otp");
  156 | 		expect(verifyLog).toBeDefined();
  157 | 		if (!verifyLog) throw new Error("Verify log not found");
  158 | 		expect(verifyLog.actorId).toBe(userId);
  159 | 		expect(verifyLog.targetType).toBe("user");
  160 | 		expect(verifyLog.targetId).toBe(userId);
  161 | 		expect(verifyLog.before).toEqual({ status: "pending_verification" });
  162 | 		expect(verifyLog.after).toEqual({ status: "active" });
  163 | 
  164 | 		// 3. Log in with active user credentials via UI
  165 | 		await page.goto("/login");
  166 | 		await page.locator('input[type="text"]').first().fill(email);
  167 | 		await page.locator('input[type="password"]').first().fill(password);
  168 | 		await page.locator('form button[type="submit"]').click();
  169 | 
  170 | 		// Verify successful login. The app now redirects authenticated users to
  171 | 		// the role dashboard immediately, so assert persisted session state
  172 | 		// rather than the transient LoginPage success banner.
  173 | 		await expect
  174 | 			.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
  175 | 			.toBeTruthy();
  176 | 		await expect(page).toHaveURL(/\/dashboard$/);
  177 | 
  178 | 		// Verify audit log 'auth.login' is written
  179 | 		const loginLogsResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
  180 | 		const loginLog = loginLogsResult.logs.find((l) => l.action === "auth.login");
  181 | 		expect(loginLog).toBeDefined();
  182 | 		if (!loginLog) throw new Error("Login log not found");
  183 | 		expect(loginLog.actorId).toBe(userId);
  184 | 		expect(loginLog.targetType).toBe("user");
  185 | 		expect(loginLog.targetId).toBe(userId);
  186 | 		expect(loginLog.before).toBeNull();
  187 | 		expect(loginLog.after).toBeNull();
  188 | 	});
  189 | 
  190 | 	test("failed login attempt does not record audit logs and preserves DB state", async ({
  191 | 		page,
  192 | 	}) => {
  193 | 		// Find logs before
  194 | 		const userResult = runDbHelper("get-user", email) as unknown as DbHelperUserResult;
  195 | 		expect(userResult.user).toBeDefined();
  196 | 		if (!userResult.user) throw new Error("User not found");
  197 | 		const userId = userResult.user.id;
  198 | 		const logsBeforeResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
  199 | 		const logsBefore = logsBeforeResult.logs;
  200 | 
  201 | 		// Try to login with wrong password
  202 | 		await page.goto("/login");
```
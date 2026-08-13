# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login (E2E, real backend) >> logs in successfully with the seed admin account
- Location: tests\e2e\login.spec.ts:43:2

# Error details

```
Error: expect(received).toBeTruthy()

Received: null

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e7]:
      - img "CTMS Logo" [ref=e9]
      - generic [ref=e10]: CTMS
    - generic [ref=e11]:
      - heading "Sẵn sàng cho hành trình tiếp theo" [level=1] [ref=e12]
      - generic [ref=e13]:
        - generic [ref=e14]: Offline Maps
        - generic [ref=e23]: Weather Risk
        - generic [ref=e27]: AI Analytics
        - generic [ref=e39]: GPS Tracking
    - generic [ref=e44]: Hệ thống quản lý leo núi đạt chuẩn quốc tế
  - generic [ref=e50]:
    - heading "Chào mừng trở lại" [level=2] [ref=e51]
    - paragraph [ref=e52]: Đăng nhập để tiếp tục hành trình của bạn.
    - generic [ref=e53]:
      - generic [ref=e54]:
        - generic [ref=e55]: Email hoặc số điện thoại
        - textbox "your@email.com hoặc 09xxxxxxxx" [ref=e60]: admin@ctms.local
      - generic [ref=e61]:
        - generic [ref=e62]: Mật khẩu
        - generic [ref=e63]:
          - textbox "••••••••" [ref=e67]: Admin@123
          - button [ref=e68]
      - generic [ref=e72]:
        - generic [ref=e73] [cursor=pointer]:
          - checkbox "Ghi nhớ" [ref=e74]
          - generic [ref=e75]: Ghi nhớ
        - button "Quên mật khẩu?" [ref=e76]
      - alert [ref=e77]:
        - paragraph [ref=e78]: Đăng nhập thất bại. Vui lòng thử lại.
      - button "Đăng nhập" [ref=e79] [cursor=pointer]
      - button "Đăng ký tài khoản mới" [ref=e83] [cursor=pointer]
    - generic [ref=e84]: Hoặc đăng nhập bằng
    - button "Đăng nhập bằng Google" [ref=e88] [cursor=pointer]
    - generic [ref=e95]:
      - paragraph [ref=e96]:
        - text: Bạn chưa có tài khoản?
        - button "Đăng ký ngay" [ref=e97] [cursor=pointer]
      - button "Quay về trang chủ" [ref=e98] [cursor=pointer]
```

# Test source

```ts
  1  | import { execSync } from "node:child_process";
  2  | import path from "node:path";
  3  | import { type Page, expect, test } from "@playwright/test";
  4  | 
  5  | // Matches httpClient.ts's own default (VITE_API_BASE_URL fallback). E2E
  6  | // setup calls the backend directly to create fixtures the UI can't (a
  7  | // pending_verification account), the same way register.spec.ts drives state
  8  | // through the real API rather than seeding the database directly.
  9  | const API_BASE_URL = "http://localhost:3000/api";
  10 | const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
  11 | 
  12 | function uniqueEmail(tag: string): string {
  13 | 	return `e2e-login-${tag}-${Date.now()}@example.com`;
  14 | }
  15 | 
  16 | function uniqueLocalPhone(): string {
  17 | 	const timestampPart = Date.now().toString().slice(-3);
  18 | 	const randomPart = Math.floor(Math.random() * 100000)
  19 | 		.toString()
  20 | 		.padStart(5, "0");
  21 | 	return `09${timestampPart}${randomPart}`;
  22 | }
  23 | 
  24 | async function fillAndSubmit(page: Page, identifier: string, password: string): Promise<void> {
  25 | 	await page.goto("/login");
  26 | 	await page.locator('input[type="text"]').first().fill(identifier);
  27 | 	await page.locator('input[type="password"]').first().fill(password);
  28 | 	await page.locator('form button[type="submit"]').click();
  29 | }
  30 | 
  31 | test.describe("Login (E2E, real backend)", () => {
  32 | 	test.describe.configure({ mode: "serial" });
  33 | 
  34 | 	test.beforeAll(() => {
  35 | 		execSync("pnpm --filter @ctms/api seed:dev-admin", {
  36 | 			cwd: WORKSPACE_ROOT,
  37 | 			stdio: "inherit",
  38 | 		});
  39 | 	});
  40 | 
  41 | 	// E2E-TC1: Logs in successfully with the dev-only seed admin account
  42 | 	// (admin@ctms.local / Admin@123, chore(CTMS-03): dev-only seed admin).
  43 | 	test("logs in successfully with the seed admin account", async ({ page }) => {
  44 | 		await fillAndSubmit(page, "admin@ctms.local", "Admin@123");
  45 | 
  46 | 		await expect
  47 | 			.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
> 48 | 			.toBeTruthy();
     |     ^ Error: expect(received).toBeTruthy()
  49 | 		await expect
  50 | 			.poll(() => page.evaluate(() => window.localStorage.getItem("refreshToken")))
  51 | 			.toBeTruthy();
  52 | 		await expect(page).toHaveURL(/\/admin\/users$/);
  53 | 	});
  54 | 
  55 | 	// E2E-TC2: Wrong password (401 Invalid credentials, mapped to Vietnamese copy)
  56 | 	test("rejects a wrong password with a Vietnamese error message", async ({ page }) => {
  57 | 		await fillAndSubmit(page, "admin@ctms.local", "WrongPassword1");
  58 | 
  59 | 		await expect(page.getByRole("alert")).toContainText(/không chính xác/i);
  60 | 	});
  61 | 
  62 | 	// E2E-TC3: Account not yet verified (401 Account is not active). A fresh
  63 | 	// account is created through the real register API (status defaults to
  64 | 	// pending_verification), then login is attempted through the real UI.
  65 | 	test("rejects a not-yet-active account with a Vietnamese error message", async ({
  66 | 		page,
  67 | 		request,
  68 | 	}) => {
  69 | 		const email = uniqueEmail("tc3");
  70 | 		const password = "Verify@123";
  71 | 
  72 | 		const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
  73 | 			data: {
  74 | 				email,
  75 | 				phone: uniqueLocalPhone(),
  76 | 				password,
  77 | 				role: "camper",
  78 | 			},
  79 | 		});
  80 | 		expect(registerResponse.ok()).toBe(true);
  81 | 
  82 | 		await fillAndSubmit(page, email, password);
  83 | 
  84 | 		await expect(page.getByRole("alert")).toContainText(/chưa được kích hoạt/i);
  85 | 	});
  86 | });
  87 | 
```
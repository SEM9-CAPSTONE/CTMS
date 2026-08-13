# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: refresh-session.spec.ts >> Refresh Authentication Session — Web Integration (E2E, real backend) >> clears the session and redirects to Login when the refresh token is revoked/invalid
- Location: tests\e2e\refresh-session.spec.ts:151:2

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
  1   | import { execSync } from "node:child_process";
  2   | import path from "node:path";
  3   | import { type Page, expect, test } from "@playwright/test";
  4   | 
  5   | /**
  6   |  * CTMS-04-T02, Step 8. Real backend, real browser, no mocked production
  7   |  * code -- only the network boundary is intercepted via `page.route()`
  8   |  * (real fetch/DOM/localStorage/`storage` events, exactly like
  9   |  * login.spec.ts / register.spec.ts already do for their own scenarios).
  10  |  *
  11  |  * Uses the same dev-only seed admin account as login.spec.ts
  12  |  * (admin@ctms.local / Admin@123) so every test starts from a real,
  13  |  * already-active account without needing OTP verification first.
  14  |  *
  15  |  * `/camper/profile` (CTMS-07) is the only existing protected page in the
  16  |  * app today, so it is the vehicle for every "protected request" scenario
  17  |  * below. Its data fetch runs inside `useCamperProfile.ts`'s `useEffect`,
  18  |  * and `main.tsx` wraps the app in `React.StrictMode` -- in the Vite dev
  19  |  * server this Playwright config runs against, StrictMode deliberately
  20  |  * double-invokes that effect, so a single page load genuinely fires 2 real
  21  |  * `GET /profiles/me` calls through the app's own `httpClient` singleton.
  22  |  * That is what scenario 2 below uses for real concurrency (see its own
  23  |  * comment) -- not a fabricated multi-action trigger, since the current UI
  24  |  * has no other page that fires 2+ independent protected requests at once.
  25  |  */
  26  | 
  27  | const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
  28  | const ADMIN_IDENTIFIER = "admin@ctms.local";
  29  | const ADMIN_PASSWORD = "Admin@123";
  30  | const LOAD_ERROR_MESSAGE =
  31  | 	"Không thể tải hồ sơ. Vui lòng kiểm tra phiên đăng nhập hoặc thử lại sau.";
  32  | const LOADING_TEXT = "Đang tải hồ sơ Camper...";
  33  | 
  34  | async function loginAsAdmin(page: Page): Promise<void> {
  35  | 	await page.goto("/login");
  36  | 	await page.locator('input[type="text"]').first().fill(ADMIN_IDENTIFIER);
  37  | 	await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  38  | 	await page.locator('form button[type="submit"]').click();
  39  | 	await expect
  40  | 		.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
> 41  | 		.toBeTruthy();
      |    ^ Error: expect(received).toBeTruthy()
  42  | }
  43  | 
  44  | /** Fulfills the first `failCount` matching requests with a fake 401 (an
  45  |  * "expired/invalid access token" response shape), then lets every request
  46  |  * after that through to the real backend untouched. */
  47  | async function failFirstNRequests(
  48  | 	page: Page,
  49  | 	urlPattern: string,
  50  | 	failCount: number
  51  | ): Promise<void> {
  52  | 	let callCount = 0;
  53  | 	await page.route(urlPattern, async (route) => {
  54  | 		callCount += 1;
  55  | 		if (callCount <= failCount) {
  56  | 			await route.fulfill({
  57  | 				status: 401,
  58  | 				contentType: "application/json",
  59  | 				body: JSON.stringify({ statusCode: 401, message: "jwt expired" }),
  60  | 			});
  61  | 			return;
  62  | 		}
  63  | 		await route.continue();
  64  | 	});
  65  | }
  66  | 
  67  | async function waitForProfileLoadOutcome(page: Page): Promise<void> {
  68  | 	await expect(page.getByText(LOADING_TEXT)).toBeHidden();
  69  | }
  70  | 
  71  | test.describe("Refresh Authentication Session — Web Integration (E2E, real backend)", () => {
  72  | 	test.beforeAll(() => {
  73  | 		execSync("pnpm --filter @ctms/api seed:dev-admin", {
  74  | 			cwd: WORKSPACE_ROOT,
  75  | 			stdio: "inherit",
  76  | 		});
  77  | 	});
  78  | 
  79  | 	// --- Scenario 1: access token expires mid-flow, transparent continuation ----
  80  | 
  81  | 	test("continues transparently after the access token expires mid-flow, without redirecting to Login", async ({
  82  | 		page,
  83  | 	}) => {
  84  | 		await loginAsAdmin(page);
  85  | 		const oldRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));
  86  | 
  87  | 		let refreshCallCount = 0;
  88  | 		await page.route("**/api/auth/refresh", async (route) => {
  89  | 			refreshCallCount += 1;
  90  | 			await route.continue(); // real backend, real (still-valid) refresh token
  91  | 		});
  92  | 		// StrictMode double-invokes the profile fetch effect (see file doc
  93  | 		// comment) -- covering both real calls with a fake 401 here.
  94  | 		await failFirstNRequests(page, "**/api/profiles/me", 2);
  95  | 
  96  | 		await page.goto("/camper/profile");
  97  | 		await waitForProfileLoadOutcome(page);
  98  | 
  99  | 		// Never bounced to Login -- the failure was recovered transparently.
  100 | 		await expect(page).toHaveURL(/\/camper\/profile$/);
  101 | 		await expect(page.getByText(LOAD_ERROR_MESSAGE)).not.toBeVisible();
  102 | 
  103 | 		const newAccessToken = await page.evaluate(() => window.localStorage.getItem("accessToken"));
  104 | 		const newRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));
  105 | 		expect(newAccessToken).toBeTruthy();
  106 | 		// Rotation proof uses the refresh token, not the access token: the
  107 | 		// backend's access-token JWT has no `jti` and encodes `iat` at
  108 | 		// whole-second granularity (confirmed by decoding a real token from
  109 | 		// this suite), so a login immediately followed by a refresh in the
  110 | 		// same wall-clock second can legitimately produce byte-identical JWTs
  111 | 		// -- that is not a bug, just not a reliable rotation signal. The
  112 | 		// refresh token is an opaque random value with no such collision risk
  113 | 		// (see CTMS-04-T01's AuthService.refresh()), so it is the one DG-02
  114 | 		// rotation actually needs proven here.
  115 | 		expect(newRefreshToken).toBeTruthy();
  116 | 		expect(newRefreshToken).not.toBe(oldRefreshToken); // DG-02: rotated
  117 | 		expect(refreshCallCount).toBeGreaterThanOrEqual(1);
  118 | 	});
  119 | 
  120 | 	// --- Scenario 2: concurrent protected requests -> exactly 1 refresh call ----
  121 | 
  122 | 	test("collapses concurrent protected 401s into exactly one /auth/refresh call", async ({
  123 | 		page,
  124 | 	}) => {
  125 | 		await loginAsAdmin(page);
  126 | 
  127 | 		let refreshCallCount = 0;
  128 | 		await page.route("**/api/auth/refresh", async (route) => {
  129 | 			refreshCallCount += 1;
  130 | 			await route.continue();
  131 | 		});
  132 | 		// Real concurrency: React StrictMode's dev-mode double-invoke of
  133 | 		// useCamperProfile's effect fires 2 genuine GET /profiles/me calls
  134 | 		// through the same httpClient singleton (see file doc comment for
  135 | 		// why this is the mechanism used, not a fabricated trigger).
  136 | 		await failFirstNRequests(page, "**/api/profiles/me", 2);
  137 | 
  138 | 		await page.goto("/camper/profile");
  139 | 		await waitForProfileLoadOutcome(page);
  140 | 
  141 | 		await expect(page).toHaveURL(/\/camper\/profile$/);
```
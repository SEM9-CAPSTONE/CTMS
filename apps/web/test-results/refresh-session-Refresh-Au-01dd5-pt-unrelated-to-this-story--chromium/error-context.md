# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: refresh-session.spec.ts >> Refresh Authentication Session — Web Integration (E2E, real backend) >> still rejects a wrong password with 401 and no refresh attempt (unrelated to this story)
- Location: tests\e2e\refresh-session.spec.ts:278:2

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected pattern: /không chính xác/i
Received string:  "Đăng nhập thất bại. Vui lòng thử lại."
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('alert')
    6 × locator resolved to <div role="alert" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3">…</div>
      - unexpected value "Đăng nhập thất bại. Vui lòng thử lại."

```

```yaml
- alert:
  - paragraph: Đăng nhập thất bại. Vui lòng thử lại.
```

# Test source

```ts
  192 | 		await loginAsAdmin(page);
  193 | 
  194 | 		const pageB = await context.newPage();
  195 | 		await pageB.goto("/camper/profile");
  196 | 		await waitForProfileLoadOutcome(pageB);
  197 | 		await expect(pageB).toHaveURL(/\/camper\/profile$/); // starts authenticated
  198 | 
  199 | 		// Page A alone triggers a real refresh failure -- no test-only hook,
  200 | 		// same production flow as scenario 3. Page B makes no request of its
  201 | 		// own during this test; it can only react to the real `storage` event
  202 | 		// authSessionSync.ts's initAuthSessionSync() (main.tsx) is listening
  203 | 		// for, exactly the CTMS-08-independent mechanism DG-03 confirmed
  204 | 		// (no real logout feature/API involved).
  205 | 		await page.route("**/api/profiles/me", async (route) => {
  206 | 			await route.fulfill({
  207 | 				status: 401,
  208 | 				contentType: "application/json",
  209 | 				body: JSON.stringify({}),
  210 | 			});
  211 | 		});
  212 | 		await page.route("**/api/auth/refresh", async (route) => {
  213 | 			await route.fulfill({
  214 | 				status: 401,
  215 | 				contentType: "application/json",
  216 | 				body: JSON.stringify({}),
  217 | 			});
  218 | 		});
  219 | 		await page.goto("/camper/profile");
  220 | 
  221 | 		await expect(page).toHaveURL(/\/login$/);
  222 | 		await expect(pageB).toHaveURL(/\/login$/);
  223 | 	});
  224 | 
  225 | 	// --- Scenario 5: final consistency + no token leakage ------------------------
  226 | 
  227 | 	test("rotates tokens end-to-end with no token leakage in requests, console, or the cross-tab signal", async ({
  228 | 		page,
  229 | 	}) => {
  230 | 		await loginAsAdmin(page);
  231 | 		const oldAccessToken = await page.evaluate(() => window.localStorage.getItem("accessToken"));
  232 | 		const oldRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));
  233 | 
  234 | 		const requestUrls: string[] = [];
  235 | 		const consoleMessages: string[] = [];
  236 | 		page.on("request", (req) => requestUrls.push(req.url()));
  237 | 		page.on("console", (msg) => consoleMessages.push(msg.text()));
  238 | 
  239 | 		await page.route("**/api/auth/refresh", (route) => route.continue());
  240 | 		await failFirstNRequests(page, "**/api/profiles/me", 2);
  241 | 
  242 | 		await page.goto("/camper/profile");
  243 | 		await waitForProfileLoadOutcome(page);
  244 | 		await expect(page).toHaveURL(/\/camper\/profile$/);
  245 | 
  246 | 		const newAccessToken = await page.evaluate(() => window.localStorage.getItem("accessToken"));
  247 | 		const newRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));
  248 | 		expect(newAccessToken).toBeTruthy();
  249 | 		expect(newRefreshToken).toBeTruthy();
  250 | 		// Access-token equality is not asserted here: the backend's JWT has no
  251 | 		// `jti` and encodes `iat` at whole-second granularity, so a login
  252 | 		// immediately followed by a refresh within the same second can
  253 | 		// legitimately yield a byte-identical (still valid, still rotated
  254 | 		// server-side) JWT -- see scenario 1's comment for the decoded proof.
  255 | 		// The refresh token has no such collision risk (opaque random value).
  256 | 		expect(newRefreshToken).not.toBe(oldRefreshToken);
  257 | 
  258 | 		// No raw token value ever appears in a request URL or a console message.
  259 | 		for (const token of [oldAccessToken, newAccessToken, oldRefreshToken, newRefreshToken]) {
  260 | 			if (!token) continue;
  261 | 			for (const url of requestUrls) {
  262 | 				expect(url).not.toContain(token);
  263 | 			}
  264 | 			for (const message of consoleMessages) {
  265 | 				expect(message).not.toContain(token);
  266 | 			}
  267 | 		}
  268 | 
  269 | 		// The cross-tab signal itself is a plain timestamp, never a token.
  270 | 		const signal = await page.evaluate(() => window.localStorage.getItem("authSessionSignal"));
  271 | 		if (signal) {
  272 | 			expect(Number.isNaN(Number(signal))).toBe(false);
  273 | 		}
  274 | 	});
  275 | 
  276 | 	// --- Regression: unauthenticated login still behaves exactly as before ------
  277 | 
  278 | 	test("still rejects a wrong password with 401 and no refresh attempt (unrelated to this story)", async ({
  279 | 		page,
  280 | 	}) => {
  281 | 		let refreshCallCount = 0;
  282 | 		await page.route("**/api/auth/refresh", async (route) => {
  283 | 			refreshCallCount += 1;
  284 | 			await route.continue();
  285 | 		});
  286 | 
  287 | 		await page.goto("/login");
  288 | 		await page.locator('input[type="text"]').first().fill(ADMIN_IDENTIFIER);
  289 | 		await page.locator('input[type="password"]').first().fill("WrongPassword1");
  290 | 		await page.locator('form button[type="submit"]').click();
  291 | 
> 292 | 		await expect(page.getByRole("alert")).toContainText(/không chính xác/i);
      |                                         ^ Error: expect(locator).toContainText(expected) failed
  293 | 		expect(refreshCallCount).toBe(0);
  294 | 	});
  295 | });
  296 | 
```
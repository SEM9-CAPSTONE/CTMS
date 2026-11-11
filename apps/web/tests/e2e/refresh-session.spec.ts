import { execSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

/**
 * CTMS-04-T02, Step 8. Real backend, real browser, no mocked production
 * code -- only the network boundary is intercepted via `page.route()`
 * (real fetch/DOM/localStorage/`storage` events, exactly like
 * login.spec.ts / register.spec.ts already do for their own scenarios).
 *
 * Uses the same dev-only seed admin account as login.spec.ts
 * (admin@ctms.local / Admin@123) so every test starts from a real,
 * already-active account without needing OTP verification first.
 *
 * `/camper/profile` (CTMS-07) is the only existing protected page in the
 * app today, so it is the vehicle for every "protected request" scenario
 * below. Its data fetch runs inside `useCamperProfile.ts`'s `useEffect`,
 * and `main.tsx` wraps the app in `React.StrictMode` -- in the Vite dev
 * server this Playwright config runs against, StrictMode deliberately
 * double-invokes that effect, so a single page load genuinely fires 2 real
 * `GET /profiles/me` calls through the app's own `httpClient` singleton.
 * That is what scenario 2 below uses for real concurrency (see its own
 * comment) -- not a fabricated multi-action trigger, since the current UI
 * has no other page that fires 2+ independent protected requests at once.
 */

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const ADMIN_IDENTIFIER = "admin@ctms.local";
const ADMIN_PASSWORD = "Admin@123";
const LOAD_ERROR_MESSAGE =
	"Không thể tải hồ sơ. Vui lòng kiểm tra phiên đăng nhập hoặc thử lại sau.";
const LOADING_TEXT = "Đang tải hồ sơ Camper...";

async function loginAsAdmin(page: Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(ADMIN_IDENTIFIER);
	await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect
		.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
		.toBeTruthy();
}

/** Fulfills the first `failCount` matching requests with a fake 401 (an
 * "expired/invalid access token" response shape), then lets every request
 * after that through to the real backend untouched. */
async function failFirstNRequests(
	page: Page,
	urlPattern: string,
	failCount: number
): Promise<void> {
	let callCount = 0;
	await page.route(urlPattern, async (route) => {
		callCount += 1;
		if (callCount <= failCount) {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({ statusCode: 401, message: "jwt expired" }),
			});
			return;
		}
		await route.continue();
	});
}

async function waitForProfileLoadOutcome(page: Page): Promise<void> {
	await expect(page.getByText(LOADING_TEXT)).toBeHidden();
}

test.describe("Refresh Authentication Session — Web Integration (E2E, real backend)", () => {
	test.beforeAll(() => {
		execSync("pnpm --filter @ctms/api seed:dev-admin", {
			cwd: WORKSPACE_ROOT,
			stdio: "inherit",
		});
	});

	// --- Scenario 1: access token expires mid-flow, transparent continuation ----

	test("continues transparently after the access token expires mid-flow, without redirecting to Login", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		const oldRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));

		let refreshCallCount = 0;
		await page.route("**/api/auth/refresh", async (route) => {
			refreshCallCount += 1;
			await route.continue(); // real backend, real (still-valid) refresh token
		});
		// StrictMode double-invokes the profile fetch effect (see file doc
		// comment) -- covering both real calls with a fake 401 here.
		await failFirstNRequests(page, "**/api/profiles/me", 2);

		await page.goto("/camper/profile");
		await waitForProfileLoadOutcome(page);

		// Never bounced to Login -- the failure was recovered transparently.
		await expect(page).toHaveURL(/\/camper\/profile$/);
		await expect(page.getByText(LOAD_ERROR_MESSAGE)).not.toBeVisible();

		const newAccessToken = await page.evaluate(() => window.localStorage.getItem("accessToken"));
		const newRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));
		expect(newAccessToken).toBeTruthy();
		// Rotation proof uses the refresh token, not the access token: the
		// backend's access-token JWT has no `jti` and encodes `iat` at
		// whole-second granularity (confirmed by decoding a real token from
		// this suite), so a login immediately followed by a refresh in the
		// same wall-clock second can legitimately produce byte-identical JWTs
		// -- that is not a bug, just not a reliable rotation signal. The
		// refresh token is an opaque random value with no such collision risk
		// (see CTMS-04-T01's AuthService.refresh()), so it is the one DG-02
		// rotation actually needs proven here.
		expect(newRefreshToken).toBeTruthy();
		expect(newRefreshToken).not.toBe(oldRefreshToken); // DG-02: rotated
		expect(refreshCallCount).toBeGreaterThanOrEqual(1);
	});

	// --- Scenario 2: concurrent protected requests -> exactly 1 refresh call ----

	test("collapses concurrent protected 401s into exactly one /auth/refresh call", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		let refreshCallCount = 0;
		await page.route("**/api/auth/refresh", async (route) => {
			refreshCallCount += 1;
			await route.continue();
		});
		// Real concurrency: React StrictMode's dev-mode double-invoke of
		// useCamperProfile's effect fires 2 genuine GET /profiles/me calls
		// through the same httpClient singleton (see file doc comment for
		// why this is the mechanism used, not a fabricated trigger).
		await failFirstNRequests(page, "**/api/profiles/me", 2);

		await page.goto("/camper/profile");
		await waitForProfileLoadOutcome(page);

		await expect(page).toHaveURL(/\/camper\/profile$/);
		await expect(page.getByText(LOAD_ERROR_MESSAGE)).not.toBeVisible();
		// Single-flight: 2 concurrent 401s collapsed into exactly 1 refresh
		// call, matching the Step 7 unit-level proof, now shown end-to-end
		// against the real backend in a real browser.
		expect(refreshCallCount).toBe(1);
	});

	// --- Scenario 3: refresh token revoked/invalid -> clear + redirect ----------

	test("clears the session and redirects to Login when the refresh token is revoked/invalid", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.route("**/api/profiles/me", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({ statusCode: 401, message: "jwt expired" }),
			});
		});
		await page.route("**/api/auth/refresh", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({ statusCode: 401, message: "Invalid refresh token" }),
			});
		});

		await page.goto("/camper/profile");

		await expect(page).toHaveURL(/\/login$/);
		await expect(
			page.evaluate(() => window.localStorage.getItem("accessToken"))
		).resolves.toBeNull();
		await expect(
			page.evaluate(() => window.localStorage.getItem("refreshToken"))
		).resolves.toBeNull();
		// No backend-specific detail ("Invalid refresh token") ever reaches the
		// page -- there is nothing on /login that could even render it, and
		// the shared message is intentionally generic (Security Constraint #6).
		await expect(page.getByText("Invalid refresh token")).toHaveCount(0);
	});

	// --- Scenario 4: cross-tab session invalidation -----------------------------

	test("propagates session invalidation to another tab via the storage signal", async ({
		context,
		page,
	}) => {
		await loginAsAdmin(page);

		const pageB = await context.newPage();
		await pageB.goto("/camper/profile");
		await waitForProfileLoadOutcome(pageB);
		await expect(pageB).toHaveURL(/\/camper\/profile$/); // starts authenticated

		// Page A alone triggers a real refresh failure -- no test-only hook,
		// same production flow as scenario 3. Page B makes no request of its
		// own during this test; it can only react to the real `storage` event
		// authSessionSync.ts's initAuthSessionSync() (main.tsx) is listening
		// for, exactly the CTMS-08-independent mechanism DG-03 confirmed
		// (no real logout feature/API involved).
		await page.route("**/api/profiles/me", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({}),
			});
		});
		await page.route("**/api/auth/refresh", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({}),
			});
		});
		await page.goto("/camper/profile");

		await expect(page).toHaveURL(/\/login$/);
		await expect(pageB).toHaveURL(/\/login$/);
	});

	// --- Scenario 5: final consistency + no token leakage ------------------------

	test("rotates tokens end-to-end with no token leakage in requests, console, or the cross-tab signal", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		const oldAccessToken = await page.evaluate(() => window.localStorage.getItem("accessToken"));
		const oldRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));

		const requestUrls: string[] = [];
		const consoleMessages: string[] = [];
		page.on("request", (req) => requestUrls.push(req.url()));
		page.on("console", (msg) => consoleMessages.push(msg.text()));

		await page.route("**/api/auth/refresh", (route) => route.continue());
		await failFirstNRequests(page, "**/api/profiles/me", 2);

		await page.goto("/camper/profile");
		await waitForProfileLoadOutcome(page);
		await expect(page).toHaveURL(/\/camper\/profile$/);

		const newAccessToken = await page.evaluate(() => window.localStorage.getItem("accessToken"));
		const newRefreshToken = await page.evaluate(() => window.localStorage.getItem("refreshToken"));
		expect(newAccessToken).toBeTruthy();
		expect(newRefreshToken).toBeTruthy();
		// Access-token equality is not asserted here: the backend's JWT has no
		// `jti` and encodes `iat` at whole-second granularity, so a login
		// immediately followed by a refresh within the same second can
		// legitimately yield a byte-identical (still valid, still rotated
		// server-side) JWT -- see scenario 1's comment for the decoded proof.
		// The refresh token has no such collision risk (opaque random value).
		expect(newRefreshToken).not.toBe(oldRefreshToken);

		// No raw token value ever appears in a request URL or a console message.
		for (const token of [oldAccessToken, newAccessToken, oldRefreshToken, newRefreshToken]) {
			if (!token) continue;
			for (const url of requestUrls) {
				expect(url).not.toContain(token);
			}
			for (const message of consoleMessages) {
				expect(message).not.toContain(token);
			}
		}

		// The cross-tab signal itself is a plain timestamp, never a token.
		const signal = await page.evaluate(() => window.localStorage.getItem("authSessionSignal"));
		if (signal) {
			expect(Number.isNaN(Number(signal))).toBe(false);
		}
	});

	// --- Regression: unauthenticated login still behaves exactly as before ------

	test("still rejects a wrong password with 401 and no refresh attempt (unrelated to this story)", async ({
		page,
	}) => {
		let refreshCallCount = 0;
		await page.route("**/api/auth/refresh", async (route) => {
			refreshCallCount += 1;
			await route.continue();
		});

		await page.goto("/login");
		await page.locator('input[type="text"]').first().fill(ADMIN_IDENTIFIER);
		await page.locator('input[type="password"]').first().fill("WrongPassword1");
		await page.locator('form button[type="submit"]').click();

		await expect(page.getByRole("alert")).toContainText(/không chính xác/i);
		expect(refreshCallCount).toBe(0);
	});
});

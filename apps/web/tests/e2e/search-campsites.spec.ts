import { execSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

/**
 * CTMS-17-T02 (CTMS-78). Fully real E2E: real Chromium, real Web UI, real
 * `GET /campsites` against the real (already-merged, CTMS-77) NestJS
 * backend and real Postgres -- no `page.route()` interception of the
 * campsites API anywhere in this file. CTMS-77 has no Create Campsite API,
 * so fixtures are seeded directly via db-helper.ts (mirrors
 * services/api/test/support/campsite-fixtures.ts's Jest helper).
 */

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const PASSWORD = "S3curePass!";

function uniqueTag(tag: string): string {
	return `${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function uniqueEmail(tag: string): string {
	return `e2e-campsites-${uniqueTag(tag)}@example.com`;
}

function uniqueLocalPhone(): string {
	const timestampPart = Date.now().toString().slice(-3);
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `09${timestampPart}${randomPart}`;
}

function runDbHelper(action: string, arg: string): Record<string, unknown> {
	const cmd = `pnpm --filter @ctms/api exec ts-node src/seeds/db-helper.ts ${action} ${arg}`;
	const stdout = execSync(cmd, { cwd: WORKSPACE_ROOT }).toString();
	return JSON.parse(stdout) as Record<string, unknown>;
}

/** JSON payloads go over the CLI base64-encoded (db-helper.ts's parseJsonArg) -- avoids cross-platform shell-quoting a raw JSON string. */
function runDbHelperJson<T>(action: string, payload: unknown): T {
	const arg = Buffer.from(JSON.stringify(payload)).toString("base64");
	return runDbHelper(action, arg) as T;
}

interface SeededCampsite {
	id: string;
	name: string;
	province: string;
	status: string;
}

interface SeedCampsitesResult {
	hostId: string;
	campsites: SeededCampsite[];
}

interface CapturedSession {
	accessToken: string;
	refreshToken: string;
	authUser: string;
}

/** Injects a REAL, backend-issued session (captured from an actual login) into a fresh page -- not a fabricated token, and no `campsitesService`/API mocking. */
async function injectSession(page: Page, session: CapturedSession): Promise<void> {
	await page.addInitScript((s) => {
		localStorage.setItem("accessToken", s.accessToken);
		localStorage.setItem("refreshToken", s.refreshToken);
		localStorage.setItem("authUser", s.authUser);
	}, session);
}

async function fillAndSubmitLogin(page: Page, identifier: string, password: string): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(identifier);
	await page.locator('input[type="password"]').first().fill(password);
	await page.locator('form button[type="submit"]').click();
}

/**
 * `/campsites` fires an auto-search on mount. BR-241 (Step 2) makes
 * Search/Reset/Pagination true no-ops while a request is in flight -- so a
 * test that fills a filter and clicks "Tìm kiếm" immediately after
 * `page.goto("/campsites")` can race the initial auto-search and have its
 * click silently swallowed by that very guard. Wait for the loading state
 * to clear before interacting, exactly as a real user's click would.
 */
async function waitForSearchIdle(page: Page): Promise<void> {
	await expect(page.getByText(/đang tìm kiếm campsite/i)).not.toBeVisible();
}

test.describe("Search Campsites (E2E, real backend + real Postgres)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);

	const marker = uniqueTag("CTMS78E2E").toUpperCase();
	const camperEmail = uniqueEmail("camper");
	const camperPhone = uniqueLocalPhone();
	const hostAccountEmail = uniqueEmail("host");
	const hostAccountPhone = uniqueLocalPhone();

	let capturedSession: CapturedSession | null = null;
	let seededHostId: string | null = null;
	let seededCampsiteIds: string[] = [];

	test.afterAll(() => {
		try {
			if (seededCampsiteIds.length > 0 || seededHostId) {
				runDbHelperJson("clean-campsites", {
					hostIds: seededHostId ? [seededHostId] : [],
					campsiteIds: seededCampsiteIds,
				});
			}
		} catch (e) {
			console.error("Campsite fixture cleanup failed:", e);
		}
		try {
			runDbHelper("clean-user", camperEmail);
		} catch (e) {
			console.error("Camper cleanup failed:", e);
		}
		try {
			runDbHelper("clean-user", hostAccountEmail);
		} catch (e) {
			console.error("Host account cleanup failed:", e);
		}
	});

	test("happy path: Camper registers, seeded active campsites are found by province and further narrowed by amenities; the draft campsite never appears", async ({
		page,
	}) => {
		// --- 1. Real register -> verify OTP -> login (mirrors audit-logs.spec.ts) ---
		await page.route("**/api/auth/send-otp", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ id: "mock-otp-id", status: "pending_verification" }),
			});
		});

		await page.goto("/register");
		await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
		await page.getByPlaceholder("Nguyễn Văn A").fill("CTMS78 E2E Camper");
		const passwordInputs = page.getByPlaceholder("••••••••");
		await passwordInputs.nth(0).fill(PASSWORD);
		await passwordInputs.nth(1).fill(PASSWORD);
		await page.getByPlaceholder("camper@example.com").fill(camperEmail);
		await page.getByPlaceholder("0912345678").fill(camperPhone);
		await page.getByRole("button", { name: "Đăng ký ngay" }).click();
		await expect(page).toHaveURL(/\/verify-otp$/);

		const phoneChannelButton = page.getByRole("button", { name: "Xác minh qua SĐT" });
		await phoneChannelButton.scrollIntoViewIfNeeded();
		await expect(phoneChannelButton).toBeEnabled();
		await phoneChannelButton.click({ force: true });
		const sendOtpButton = page.getByRole("button", { name: "Gửi mã OTP" });
		await expect(sendOtpButton).toBeEnabled();
		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.url().includes("/api/auth/send-otp") && response.request().method() === "POST"
			),
			sendOtpButton.click(),
		]);
		await expect(page.getByLabel("Mã OTP *")).toBeEnabled();

		const otpResult = runDbHelper("get-otp", camperEmail) as unknown as { otp: string };
		await page.getByLabel("Mã OTP *").fill(otpResult.otp);
		await page.getByRole("button", { name: "Xác minh", exact: true }).click();
		await expect(page.getByText("Xác thực thành công!")).toBeVisible();
		await page.getByRole("button", { name: "Đến trang đăng nhập ngay" }).click();
		await expect(page).toHaveURL(/\/login$/);

		await fillAndSubmitLogin(page, camperEmail, PASSWORD);
		await expect
			.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
			.toBeTruthy();

		capturedSession = await page.evaluate(() => ({
			accessToken: localStorage.getItem("accessToken") ?? "",
			refreshToken: localStorage.getItem("refreshToken") ?? "",
			authUser: localStorage.getItem("authUser") ?? "",
		}));

		// --- 2. Seed campsites directly (CTMS-77 has no Create Campsite API) ---
		const seedResult = runDbHelperJson<SeedCampsitesResult>("seed-campsites", {
			campsites: [
				{
					name: `E2E Pine Camp ${marker}`,
					province: marker,
					city: "Da Lat",
					status: "active",
					zones: [{ amenities: ["wifi", "toilet"], basePrice: "150.00" }],
					images: [{ url: "https://example.com/e2e-pine.jpg", displayOrder: 1 }],
				},
				{
					name: `E2E Beach Camp ${marker}`,
					province: marker,
					city: "Nha Trang",
					status: "active",
					zones: [{ amenities: ["bbq"], basePrice: "400.00" }],
				},
				{
					name: `E2E Draft Camp ${marker}`,
					province: marker,
					city: "Hue",
					status: "draft",
				},
			],
		});
		seededHostId = seedResult.hostId;
		seededCampsiteIds = seedResult.campsites.map((c) => c.id);

		// --- 3. Search by province: only the 2 active campsites, never the draft ---
		await page.goto("/campsites");
		await expect(page.getByRole("heading", { name: "Tìm kiếm Campsite" })).toBeVisible();
		await waitForSearchIdle(page);
		await page.getByLabel("Tỉnh/Thành").fill(marker);
		await page.getByRole("button", { name: "Tìm kiếm" }).click();

		await expect(page.getByText(`E2E Pine Camp ${marker}`)).toBeVisible();
		await expect(page.getByText(`E2E Beach Camp ${marker}`)).toBeVisible();
		await expect(page.getByText(`E2E Draft Camp ${marker}`)).not.toBeVisible();

		const coverImg = page.getByAltText(`E2E Pine Camp ${marker}`);
		await expect(coverImg).toHaveAttribute("src", "https://example.com/e2e-pine.jpg");

		await expect(page.getByText("2", { exact: true })).toBeVisible();
		await expect(page.getByText(/trang 1 \/ 1/i)).toBeVisible();

		// --- 4. Narrow further with amenities: only the wifi/toilet campsite ---
		await page.getByLabel("Tiện ích").fill("wifi");
		await page.getByRole("button", { name: "Tìm kiếm" }).click();
		await expect(page.getByText(`E2E Pine Camp ${marker}`)).toBeVisible();
		await expect(page.getByText(`E2E Beach Camp ${marker}`)).not.toBeVisible();
	});

	test("invalid-data flow: an overlong province (>100 chars, BR-205/BR-231) is rejected by the real backend (422) and creates no DB mutation", async ({
		page,
	}) => {
		// Not a negative minPrice: the "Giá từ" input is a real
		// `<input type="number" min={0}>`, so the browser's own native HTML5
		// constraint validation blocks form submission before any JS/network
		// call happens for an out-of-range value -- there would be nothing
		// for the backend to reject. `province` has no such client-side
		// constraint (no `maxLength` attribute), so an overlong value
		// genuinely reaches CTMS-77's `@MaxLength(100)` validator.
		if (!capturedSession) throw new Error("Happy-path test must run first to capture a session");
		await injectSession(page, capturedSession);

		const countBefore = runDbHelper("count-campsites", marker) as unknown as { count: number };

		await page.goto("/campsites");
		await expect(page.getByRole("heading", { name: "Tìm kiếm Campsite" })).toBeVisible();
		await waitForSearchIdle(page);
		await page.getByLabel("Tỉnh/Thành").fill("A".repeat(101));
		await page.getByRole("button", { name: "Tìm kiếm" }).click();

		await expect(
			page.getByText("Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.")
		).toBeVisible();

		const countAfter = runDbHelper("count-campsites", marker) as unknown as { count: number };
		expect(countAfter.count).toBe(countBefore.count);
	});

	test("unauthorized flow: anonymous is blocked before any campsites API call, and DB is unchanged", async ({
		page,
	}) => {
		const campsitesRequests: string[] = [];
		page.on("request", (request) => {
			const url = new URL(request.url());
			if (url.pathname === "/api/campsites") {
				campsitesRequests.push(request.url());
			}
		});

		const countBefore = runDbHelper("count-campsites", marker) as unknown as { count: number };

		await page.goto("/campsites");
		await expect(page.getByText("Yêu cầu đăng nhập")).toBeVisible();

		expect(campsitesRequests).toHaveLength(0);
		const countAfter = runDbHelper("count-campsites", marker) as unknown as { count: number };
		expect(countAfter.count).toBe(countBefore.count);
	});

	test("unauthorized flow: an authenticated Host is denied -- role mismatch, not an auth failure, and no campsites API call", async ({
		page,
	}) => {
		runDbHelperJson<{ id: string }>("create-account", {
			email: hostAccountEmail,
			phone: hostAccountPhone,
			password: PASSWORD,
			role: "host",
			status: "active",
		});

		await fillAndSubmitLogin(page, hostAccountEmail, PASSWORD);
		await expect
			.poll(() => page.evaluate(() => window.localStorage.getItem("accessToken")))
			.toBeTruthy();

		const campsitesRequests: string[] = [];
		page.on("request", (request) => {
			const url = new URL(request.url());
			if (url.pathname === "/api/campsites") {
				campsitesRequests.push(request.url());
			}
		});

		const countBefore = runDbHelper("count-campsites", marker) as unknown as { count: number };

		await page.goto("/campsites");
		await expect(page.getByText("Truy cập bị từ chối")).toBeVisible();
		await expect(page.getByText(/camper/i)).toBeVisible();

		expect(campsitesRequests).toHaveLength(0);
		const countAfter = runDbHelper("count-campsites", marker) as unknown as { count: number };
		expect(countAfter.count).toBe(countBefore.count);
	});
});

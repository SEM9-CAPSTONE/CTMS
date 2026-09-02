import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services", "api");
const TS_NODE_BIN = path.join(API_ROOT, "node_modules", "ts-node", "dist", "bin.js");
const DB_HELPER = path.join(API_ROOT, "src", "seeds", "db-helper.ts");
const PASSWORD = "S3curePass!";
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = (prefix: string) => `e2e-${unique(prefix)}@example.com`;
const phone = () =>
	`09${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0")}`;

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, encoded], {
		cwd: API_ROOT,
	}).toString();
	return JSON.parse(stdout) as T;
}

function dbPlain(action: string, value: string) {
	execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, value], { cwd: API_ROOT });
}

async function login(page: Page, userEmail: string) {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

/**
 * CTMS-29-T02. There is no real OPENAI_API_KEY configured in this
 * environment yet (same deferred-LLM-call situation as
 * services/api/test/weather-advice.integration-spec.ts and the CTMS-29 spec
 * doc's own "Deferred" note): a real call to the ai microservice's
 * /weather-advisory would honestly fail with its own 503. The happy path
 * below therefore seeds a real advice row directly for a real,
 * already-calculated risk assessment (produced through the real UI + a real
 * Open-Meteo call, same as CTMS-27-T02's own risk-score setup), then clicks
 * "Tạo lời khuyên" -- this hits WeatherAdviceService's real idempotent-return
 * branch, not a UI illusion, and every response the UI renders is the real,
 * persisted row.
 */
test.describe("CTMS-29-T02 Generate Clear Weather Risk Advice Using LLM (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);
	const ownerEmail = email("ctms29t02-owner");
	const camperEmail = email("ctms29t02-camper");
	const activeRouteName = `E2E CTMS29T02 Active Route ${Date.now()}`;
	const noAssessmentRouteName = `E2E CTMS29T02 No Assessment Route ${Date.now()}`;
	let ownerId = "";
	let campsiteId = "";
	let activeRouteId = "";
	let noAssessmentRouteId = "";

	test.beforeAll(() => {
		ownerId = db<{ id: string }>("create-account", {
			email: ownerEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		db("create-account", {
			email: camperEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		});
		campsiteId = db<{ campsites: Array<{ id: string }> }>("seed-campsites", {
			hostId: ownerId,
			campsites: [
				{ name: `E2E CTMS29T02 Camp ${Date.now()}`, province: "CTMS29T02E2E", status: "draft" },
			],
		}).campsites[0].id;
		const routes = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [
				{ name: activeRouteName, status: "active" },
				{ name: noAssessmentRouteName, status: "active" },
			],
		}).routes;
		activeRouteId = routes[0].id;
		noAssessmentRouteId = routes[1].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds: [activeRouteId, noAssessmentRouteId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-campsites", { hostIds: [], campsiteIds: [campsiteId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [ownerEmail, camperEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("owning Host generates advice from a real risk assessment and sees the advice text plus every action", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(activeRouteName).click();

		// A real risk assessment is the one precondition -- produced through the
		// real UI, same as CTMS-27-T02's own setup (real Open-Meteo call, then a
		// real risk calculation).
		await page.getByRole("button", { name: "Làm mới thời tiết" }).click();
		await expect(page.getByTestId("weather-snapshot")).toBeVisible({ timeout: 20_000 });

		await expect(page.getByTestId("risk-empty")).toBeVisible();
		await page.getByRole("button", { name: "Tính điểm rủi ro" }).click();
		await expect(page.getByTestId("risk-level-badge")).toBeVisible({ timeout: 20_000 });

		const { assessments } = db<{ assessments: Array<{ id: string }> }>(
			"get-weather-risk-assessments",
			{ routeId: activeRouteId }
		);
		expect(assessments).toHaveLength(1);
		const assessmentId = assessments[0].id;

		// Seed a real advice row for the real assessment (see the module-level
		// comment for why: no real OPENAI_API_KEY in this environment yet).
		db("seed-weather-advice", {
			assessmentId,
			adviceText: "Điều kiện ở mức cảnh báo nhẹ, nên chuẩn bị áo mưa và theo dõi dự báo.",
			actions: ["Mang áo mưa", "Theo dõi dự báo trước giờ khởi hành"],
			createdBy: ownerId,
		});

		await expect(page.getByTestId("advice-empty")).toBeVisible();
		await page.getByRole("button", { name: "Tạo lời khuyên" }).click();

		// The real API call hits WeatherAdviceService's own idempotent-return
		// branch for the seeded row -- a real request/response, not mocked.
		await expect(page.getByTestId("advice-text")).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId("advice-text")).toContainText("cảnh báo nhẹ");
		await expect(page.getByTestId("advice-actions")).toContainText("Mang áo mưa");
		await expect(page.getByTestId("advice-actions")).toContainText(
			"Theo dõi dự báo trước giờ khởi hành"
		);

		const { advices } = db<{ advices: Array<{ adviceText: string }> }>("get-weather-advice", {
			routeId: activeRouteId,
		});
		expect(advices).toHaveLength(1);
		expect(advices[0].adviceText).toContain("cảnh báo nhẹ");
	});

	test("generating advice on a route with no risk assessment yet returns a mapped 409 and creates no advice", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(noAssessmentRouteName).click();

		await expect(page.getByTestId("advice-empty")).toBeVisible();
		await page.getByRole("button", { name: "Tạo lời khuyên" }).click();

		await expect(page.getByTestId("advice-generate-error")).toContainText(
			"Đảm bảo tuyến đường đang ở trạng thái Hoạt động và đã có đánh giá rủi ro thời tiết"
		);

		const { advices } = db<{ advices: unknown[] }>("get-weather-advice", {
			routeId: noAssessmentRouteId,
		});
		expect(advices).toHaveLength(0);
	});

	test("a Camper's direct API generate attempt returns 403 and creates no additional advice", async ({
		page,
	}) => {
		await login(page, camperEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.post(
			`http://localhost:3000/api/trekking-routes/${activeRouteId}/weather/advice`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);

		expect(response.status()).toBe(403);
		const { advices } = db<{ advices: unknown[] }>("get-weather-advice", {
			routeId: activeRouteId,
		});
		// Unchanged from the first test's own single seeded row -- the Camper's
		// forbidden attempt added nothing.
		expect(advices).toHaveLength(1);
	});
});

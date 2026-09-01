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
 * CTMS-27-T02. The screens/states/hooks (RouteWeatherRiskPanel,
 * useWeatherRiskScore) already existed before this story -- built as part
 * of CTMS-26-T02's own thorough breakdown UI, which already satisfies
 * CTMS-27's ACs (shows which of the 5 criteria exceeded thresholds, not
 * just a color/aggregate score -- verified directly against
 * RouteWeatherRiskPanel.tsx before writing this file). The one real gap
 * this story closes is E2E coverage: real backend/Postgres/Chrome, and a
 * real call to the live Open-Meteo API to produce the weather snapshot the
 * risk calculation itself depends on.
 */
test.describe("CTMS-27-T02 View Weather Risk Factors (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);
	const ownerEmail = email("ctms27t02-owner");
	const camperEmail = email("ctms27t02-camper");
	const activeRouteName = `E2E CTMS27T02 Active Route ${Date.now()}`;
	const noSnapshotRouteName = `E2E CTMS27T02 No Snapshot Route ${Date.now()}`;
	let ownerId = "";
	let campsiteId = "";
	let activeRouteId = "";
	let noSnapshotRouteId = "";

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
				{ name: `E2E CTMS27T02 Camp ${Date.now()}`, province: "CTMS27T02E2E", status: "draft" },
			],
		}).campsites[0].id;
		const routes = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [
				{ name: activeRouteName, status: "active" },
				{ name: noSnapshotRouteName, status: "active" },
			],
		}).routes;
		activeRouteId = routes[0].id;
		noSnapshotRouteId = routes[1].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds: [activeRouteId, noSnapshotRouteId] });
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

	test("owning Host calculates a real risk assessment after refreshing weather, and sees every criterion", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(activeRouteName).click();

		// The risk score depends on a real, successful weather snapshot --
		// refresh it first (CTMS-25-T02's own real Open-Meteo call).
		await page.getByRole("button", { name: "Làm mới thời tiết" }).click();
		await expect(page.getByTestId("weather-snapshot")).toBeVisible({ timeout: 20_000 });

		await expect(page.getByTestId("risk-empty")).toBeVisible();
		await page.getByRole("button", { name: "Tính điểm rủi ro" }).click();

		await expect(page.getByTestId("risk-level-badge")).toBeVisible({ timeout: 20_000 });
		await expect(page.getByTestId("risk-composite-score")).toBeVisible();
		// AC2: not just a color or aggregate score -- every one of the 5
		// criteria is individually rendered.
		for (const key of ["rainfall", "wind", "temperature", "visibility", "thunderstorm"]) {
			await expect(page.getByTestId(`criterion-${key}`)).toBeVisible();
		}

		// Real DB row, not just a UI illusion -- and reproducible (BR-069):
		// re-fetching the latest assessment returns the same one, not a
		// second row.
		const { assessments } = db<{
			assessments: Array<{ riskLevel: string; criteriaScores: unknown }>;
		}>("get-weather-risk-assessments", { routeId: activeRouteId });
		expect(assessments).toHaveLength(1);
		expect(["green", "yellow", "red"]).toContain(assessments[0].riskLevel);
		expect(assessments[0].criteriaScores).toEqual(
			expect.objectContaining({
				rainfall: expect.any(Object),
				wind: expect.any(Object),
				temperature: expect.any(Object),
				visibility: expect.any(Object),
				thunderstorm: expect.any(Object),
			})
		);
	});

	test("calculating on a route with no successful weather snapshot yet returns a mapped 409 and creates no assessment", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByText(noSnapshotRouteName).click();

		await expect(page.getByTestId("risk-empty")).toBeVisible();
		await page.getByRole("button", { name: "Tính điểm rủi ro" }).click();

		await expect(page.getByTestId("risk-calculate-error")).toContainText(
			"Đảm bảo tuyến đường đang ở trạng thái Hoạt động và đã được tải dữ liệu thời tiết thành công"
		);

		const { assessments } = db<{ assessments: unknown[] }>("get-weather-risk-assessments", {
			routeId: noSnapshotRouteId,
		});
		expect(assessments).toHaveLength(0);
	});

	test("a Camper's direct API calculate attempt returns 403 and creates no assessment", async ({
		page,
	}) => {
		await login(page, camperEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.post(
			`http://localhost:3000/api/trekking-routes/${activeRouteId}/weather/risk-score`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);

		expect(response.status()).toBe(403);
		const { assessments } = db<{ assessments: unknown[] }>("get-weather-risk-assessments", {
			routeId: activeRouteId,
		});
		// Unchanged from the first test's own single successful row -- the
		// Camper's forbidden attempt added nothing.
		expect(assessments).toHaveLength(1);
	});
});

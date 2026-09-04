import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_HELPER = path.join(WORKSPACE_ROOT, "services/api/node_modules/ts-node/dist/bin.js");
const API_BASE_URL = "http://localhost:3000/api";
const PASSWORD = "S3curePass!";
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = (prefix: string) => `e2e-${unique(prefix)}@example.com`;
const phone = () =>
	`09${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0")}`;

interface StoredDangerZone {
	description: string;
	severity: "low" | "medium" | "high";
	radiusMeters: number | null;
	geometry: { type: "Point" | "Polygon"; coordinates: unknown };
}

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(
		process.execPath,
		[API_HELPER, "src/seeds/db-helper.ts", action, encoded],
		{ cwd: path.join(WORKSPACE_ROOT, "services/api") }
	).toString();
	return JSON.parse(stdout) as T;
}

function dbPlain(action: string, value: string): void {
	execFileSync(process.execPath, [API_HELPER, "src/seeds/db-helper.ts", action, value], {
		cwd: path.join(WORKSPACE_ROOT, "services/api"),
	});
}

async function login(page: Page, userEmail: string): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

async function openRoute(page: Page, campsiteId: string, routeName: string): Promise<void> {
	await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
	await page.getByRole("button", { name: new RegExp(routeName) }).click();
	await expect(page.getByTestId("route-checkpoints-panel")).toBeVisible();
}

async function clickSafetyMap(page: Page, xRatio: number, yRatio: number): Promise<void> {
	const wrapper = page.getByTestId("checkpoint-map");
	await expect(wrapper).toHaveAttribute("data-map-mode", /^(fallback|maplibre)$/);
	const mode = await wrapper.getAttribute("data-map-mode");
	const surface =
		mode === "fallback" ? wrapper.getByRole("img") : wrapper.locator("canvas").first();
	await expect(surface).toBeVisible();
	const box = await surface.boundingBox();
	if (!box) throw new Error("Expected Route safety map bounds");
	await surface.click({ position: { x: box.width * xRatio, y: box.height * yRatio } });
}

async function fillShelter(page: Page): Promise<void> {
	await page.getByLabel("Tên checkpoint").fill("E2E Emergency Shelter");
	await page.getByLabel("Loại checkpoint").selectOption("emergency_shelter");
	await page.getByLabel("Bán kính (mét)").fill("30");
	await page.getByLabel("Thời gian đến dự kiến (phút)").fill("45");
	await page.getByLabel("Hướng dẫn").fill("Stay inside until the storm passes");
}

test.describe("CTMS-90 Route hazard areas and shelters UI", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(90_000);
	const ownerEmail = email("safety-owner");
	const otherHostEmail = email("safety-other-host");
	const camperEmail = email("safety-camper");
	const campsiteName = `E2E Safety Camp ${Date.now()}`;
	const draftRouteName = `E2E Draft Safety Route ${Date.now()}`;
	const activeRouteName = `E2E Active Safety Route ${Date.now()}`;
	let ownerId = "";
	let campsiteId = "";
	let draftRouteId = "";
	let activeRouteId = "";

	test.beforeAll(() => {
		ownerId = db<{ id: string }>("create-account", {
			email: ownerEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		for (const account of [
			{ email: otherHostEmail, role: "host" },
			{ email: camperEmail, role: "camper" },
		]) {
			db("create-account", {
				email: account.email,
				phone: phone(),
				password: PASSWORD,
				role: account.role,
				status: "active",
			});
		}
		campsiteId = db<{ campsites: Array<{ id: string }> }>("seed-campsites", {
			hostId: ownerId,
			campsites: [{ name: campsiteName, province: "CTMS90E2E", status: "draft" }],
		}).campsites[0].id;
		const routes = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [
				{ name: draftRouteName, status: "draft" },
				{ name: activeRouteName, status: "active" },
			],
		}).routes;
		draftRouteId = routes[0].id;
		activeRouteId = routes[1].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds: [draftRouteId, activeRouteId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-campsites", { hostIds: [], campsiteIds: [campsiteId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [ownerEmail, otherHostEmail, camperEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("owning Host creates and reloads a shelter, Point hazard, and Polygon hazard", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		await openRoute(page, campsiteId, draftRouteName);

		await clickSafetyMap(page, 0.5, 0.5);
		await fillShelter(page);
		await page.getByRole("button", { name: "Tạo checkpoint" }).click();
		await expect(page.getByText("E2E Emergency Shelter")).toBeVisible();

		await page.getByRole("button", { name: "Điểm nguy hiểm" }).click();
		await clickSafetyMap(page, 0.55, 0.45);
		await page.getByLabel("Bán kính vùng nguy hiểm (mét)").fill("55.5");
		await page.getByLabel("Mức độ nguy hiểm").selectOption("high");
		await page.getByLabel("Mô tả an toàn").fill("E2E Point Rockfall");
		await page.getByRole("button", { name: "Tạo khu vực nguy hiểm" }).click();
		await expect(page.getByText("E2E Point Rockfall")).toBeVisible();

		await page.getByRole("button", { name: "Đa giác nguy hiểm" }).click();
		for (const [x, y] of [
			[0.3, 0.35],
			[0.7, 0.35],
			[0.5, 0.7],
		]) {
			await clickSafetyMap(page, x, y);
		}
		await page.getByRole("button", { name: "Hoàn tất đa giác" }).click();
		await page.getByLabel("Mức độ nguy hiểm").selectOption("medium");
		await page.getByLabel("Mô tả an toàn").fill("E2E Polygon Landslide");
		await page.getByRole("button", { name: "Tạo khu vực nguy hiểm" }).click();
		await expect(page.getByText("E2E Polygon Landslide")).toBeVisible();

		await page.reload();
		await page.getByRole("button", { name: new RegExp(draftRouteName) }).click();
		await expect(page.getByText("E2E Emergency Shelter")).toBeVisible();
		await expect(page.getByText("Stay inside until the storm passes")).toBeVisible();
		await expect(page.getByText("E2E Point Rockfall")).toBeVisible();
		await expect(page.getByText("E2E Polygon Landslide")).toBeVisible();

		const checkpoints = db<{ checkpoints: Array<{ type: string; instructions: string }> }>(
			"get-route-checkpoints",
			{ routeId: draftRouteId }
		).checkpoints;
		expect(checkpoints).toContainEqual(
			expect.objectContaining({
				type: "emergency_shelter",
				instructions: "Stay inside until the storm passes",
			})
		);
		const dangerZones = db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", {
			routeId: draftRouteId,
		}).dangerZones;
		expect(dangerZones).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					description: "E2E Point Rockfall",
					severity: "high",
					radiusMeters: 55.5,
				}),
				expect.objectContaining({
					description: "E2E Polygon Landslide",
					severity: "medium",
					radiusMeters: null,
				}),
			])
		);
		expect(dangerZones.map((zone) => zone.geometry.type)).toEqual(
			expect.arrayContaining(["Point", "Polygon"])
		);
	});

	test("invalid client input and non-draft controls remain non-mutating", async ({ page }) => {
		await login(page, ownerEmail);
		await openRoute(page, campsiteId, draftRouteName);
		const before = db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", {
			routeId: draftRouteId,
		}).dangerZones.length;
		await page.getByRole("button", { name: "Điểm nguy hiểm" }).click();
		await page.getByLabel("Mô tả an toàn").fill("Missing map location");
		await page.getByRole("button", { name: "Tạo khu vực nguy hiểm" }).click();
		await expect(page.getByText("Vui lòng chọn hình học trên bản đồ")).toBeVisible();
		expect(
			db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", { routeId: draftRouteId })
				.dangerZones.length
		).toBe(before);

		await page.getByRole("button", { name: new RegExp(activeRouteName) }).click();
		await expect(page.getByText(/Chỉ xem/)).toBeVisible();
		await expect(page.getByRole("button", { name: "Tạo checkpoint" })).toBeDisabled();
		await expect(page.getByRole("button", { name: "Điểm nguy hiểm" })).toBeDisabled();
		await expect(page.getByRole("button", { name: "Đa giác nguy hiểm" })).toBeDisabled();
	});

	test("foreign Host and non-Host mutations return 403 without persistence", async ({ page }) => {
		const before = db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", {
			routeId: draftRouteId,
		}).dangerZones.length;
		for (const accountEmail of [otherHostEmail, camperEmail]) {
			await login(page, accountEmail);
			const token = await page.evaluate(() => localStorage.getItem("accessToken"));
			const response = await page.request.post(
				`${API_BASE_URL}/trekking-routes/${draftRouteId}/hazard-areas`,
				{
					headers: { Authorization: `Bearer ${token}` },
					data: {
						geometry: { type: "Point", coordinates: [108.46, 11.94] },
						radiusMeters: 30,
						description: "E2E forbidden hazard",
						severity: "high",
					},
				}
			);
			expect(response.status()).toBe(403);
		}
		expect(
			db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", { routeId: draftRouteId })
				.dangerZones.length
		).toBe(before);
	});

	test("structured PostGIS 422 preserves the Polygon draft", async ({ page }) => {
		await login(page, ownerEmail);
		await openRoute(page, campsiteId, draftRouteName);
		const before = db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", {
			routeId: draftRouteId,
		}).dangerZones.length;
		await page.getByRole("button", { name: "Đa giác nguy hiểm" }).click();
		for (const [x, y] of [
			[0.25, 0.25],
			[0.75, 0.75],
			[0.25, 0.75],
			[0.75, 0.25],
		]) {
			await clickSafetyMap(page, x, y);
		}
		await page.getByRole("button", { name: "Hoàn tất đa giác" }).click();
		await page.getByLabel("Mô tả an toàn").fill("E2E Self Intersecting Polygon");
		await page.getByRole("button", { name: "Tạo khu vực nguy hiểm" }).click();
		await expect(
			page.getByRole("alert").filter({ hasText: /geometry must be a valid/ })
		).toBeVisible();
		await expect(page.getByLabel("Mô tả an toàn")).toHaveValue("E2E Self Intersecting Polygon");
		expect(
			db<{ dangerZones: StoredDangerZone[] }>("get-route-danger-zones", { routeId: draftRouteId })
				.dangerZones.length
		).toBe(before);
	});
});

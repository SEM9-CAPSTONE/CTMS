import { execSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const PASSWORD = "S3curePass!";
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = (prefix: string) => `e2e-${unique(prefix)}@example.com`;
const phone = () =>
	`09${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0")}`;

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execSync(
		`pnpm --filter @ctms/api exec ts-node src/seeds/db-helper.ts ${action} ${encoded}`,
		{ cwd: WORKSPACE_ROOT }
	).toString();
	return JSON.parse(stdout) as T;
}

function dbPlain(action: string, value: string) {
	execSync(`pnpm --filter @ctms/api exec ts-node src/seeds/db-helper.ts ${action} ${value}`, {
		cwd: WORKSPACE_ROOT,
	});
}

async function login(page: Page, userEmail: string) {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

async function fillMetadata(page: Page, campsiteId: string, name: string) {
	await page.getByLabel("Khu cắm trại").selectOption(campsiteId);
	await page.getByLabel("Tên tuyến").fill(name);
	await page.getByLabel("Độ khó").selectOption("hard");
	await page.getByLabel("Thời lượng dự kiến (phút)").fill("120");
}

test.describe("CTMS-52 Create Trekking Route on Map", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);
	const ownerEmail = email("route-owner");
	const otherHostEmail = email("route-other");
	const camperEmail = email("route-camper");
	let ownerId = "";
	let campsiteId = "";
	const routeIds: string[] = [];

	test.beforeAll(() => {
		ownerId = db<{ id: string }>("create-account", {
			email: ownerEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		db("create-account", {
			email: otherHostEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		});
		db("create-account", {
			email: camperEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		});
		campsiteId = db<{ campsites: Array<{ id: string }> }>("seed-campsites", {
			hostId: ownerId,
			campsites: [{ name: `E2E Route Camp ${Date.now()}`, province: "CTMS52E2E", status: "draft" }],
		}).campsites[0].id;
	});

	test.afterAll(() => {
		try {
			db("clean-trekking-routes", { routeIds });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-campsites", { hostIds: [], campsiteIds: [campsiteId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [ownerEmail, otherHostEmail, camperEmail])
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
	});

	test("Host manually draws and creates a draft route", async ({ page }) => {
		await login(page, ownerEmail);
		await page.goto("/host/trekking-routes/create");
		await fillMetadata(page, campsiteId, "E2E Manual Ridge");
		const map = page.getByRole("button", { name: "Bản đồ vẽ tuyến" });
		const box = await map.boundingBox();
		expect(box).toBeTruthy();
		await map.click({ position: { x: 180, y: 180 } });
		await map.click({ position: { x: 210, y: 200 } });
		await page.getByRole("button", { name: "Tạo tuyến đường" }).click();
		await expect(page.getByText("Tạo tuyến đường thành công")).toBeVisible();
		expect(await page.getByTestId("server-route-status").textContent()).toBe("draft");
		expect(
			Number((await page.getByTestId("server-route-length").textContent())?.replace(/[^0-9.]/g, ""))
		).toBeGreaterThan(0);
		const routeId = (await page.getByTestId("created-route-id").textContent())?.trim() ?? "";
		routeIds.push(routeId);
		const stored = db<{
			route: {
				geometry: { type: string; coordinates: number[][] };
				status: string;
				lengthMeters: number;
			};
		}>("get-trekking-route", { routeId });
		expect(stored.route.status).toBe("draft");
		expect(stored.route.geometry.type).toBe("LineString");
		expect(stored.route.lengthMeters).toBeGreaterThan(0);
	});

	test("Host imports an unambiguous GeoJSON route", async ({ page }) => {
		await login(page, ownerEmail);
		await page.goto("/host/trekking-routes/create");
		await fillMetadata(page, campsiteId, "E2E Imported Ridge");
		await page.getByLabel("Nhập GPX hoặc GeoJSON").setInputFiles({
			name: "route.geojson",
			mimeType: "application/geo+json",
			buffer: Buffer.from(
				JSON.stringify({
					type: "LineString",
					coordinates: [
						[108.45, 11.94],
						[108.46, 11.95],
					],
				})
			),
		});
		await page.getByRole("button", { name: "Tạo tuyến đường" }).click();
		await expect(page.getByText("Tạo tuyến đường thành công")).toBeVisible();
		routeIds.push((await page.getByTestId("created-route-id").textContent())?.trim() ?? "");
	});

	test("invalid geometry creates no route", async ({ page }) => {
		await login(page, ownerEmail);
		await page.goto("/host/trekking-routes/create");
		const before = db<{ routes: number; audits: number }>("count-trekking-routes", { campsiteId });
		await fillMetadata(page, campsiteId, "E2E Invalid Route");
		await page.getByRole("button", { name: "Tạo tuyến đường" }).click();
		await expect(page.getByText(/ít nhất 2 điểm/)).toBeVisible();
		expect(db("count-trekking-routes", { campsiteId })).toEqual(before);
	});

	test("Camper cannot access the Host page", async ({ page }) => {
		await login(page, camperEmail);
		await page.goto("/host/trekking-routes/create");
		await expect(page.getByText("Truy cập bị từ chối")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Tạo tuyến trekking trên bản đồ" })
		).not.toBeVisible();
	});

	test("non-owning Host API attempt creates no route or audit", async ({ page }) => {
		await login(page, otherHostEmail);
		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		const before = db<{ routes: number; audits: number }>("count-trekking-routes", { campsiteId });
		const response = await page.request.post("http://localhost:3000/api/trekking-routes", {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				campsiteId,
				name: "E2E Foreign Route",
				geometry: {
					type: "LineString",
					coordinates: [
						[108.45, 11.94],
						[108.46, 11.95],
					],
				},
				difficulty: "easy",
				expectedDurationMinutes: 60,
			},
		});
		expect(response.status()).toBe(403);
		expect(db("count-trekking-routes", { campsiteId })).toEqual(before);
	});
});

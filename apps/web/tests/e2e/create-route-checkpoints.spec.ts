import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_HELPER = path.join(WORKSPACE_ROOT, "services/api/node_modules/ts-node/dist/bin.js");
const PASSWORD = "S3curePass!";
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = (prefix: string) => `e2e-${unique(prefix)}@example.com`;
const phone = () =>
	`09${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0")}`;

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(
		process.execPath,
		[API_HELPER, "src/seeds/db-helper.ts", action, encoded],
		{
			cwd: path.join(WORKSPACE_ROOT, "services/api"),
		}
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

async function clickCheckpointMap(
	page: Page,
	xRatio: number,
	yRatio: number,
	yOffsetPixels = 0
): Promise<void> {
	const wrapper = page.getByTestId("checkpoint-map");
	await expect(wrapper).toBeVisible();
	await expect(wrapper).toHaveAttribute("data-map-mode", /^(fallback|maplibre)$/);
	const mode = await wrapper.getAttribute("data-map-mode");
	const surface =
		mode === "fallback"
			? wrapper.getByRole("img", { name: "Bản đồ chọn checkpoint" })
			: wrapper.locator("canvas").first();
	await expect(surface).toBeVisible();
	const box = await surface.boundingBox();
	if (!box) throw new Error("Expected checkpoint map bounds");
	await surface.click({
		position: {
			x: box.width * xRatio,
			y: box.height * yRatio + yOffsetPixels,
		},
	});
}

async function fillCheckpoint(
	page: Page,
	input: { name: string; type: "rest" | "water"; offset: string; instructions: string }
): Promise<void> {
	await page.getByLabel("Tên checkpoint").fill(input.name);
	await page.getByLabel("Loại checkpoint").selectOption(input.type);
	await page.getByLabel("Bán kính (mét)").fill("30");
	await page.getByLabel("Thời gian đến dự kiến (phút)").fill(input.offset);
	await page.getByLabel("Hướng dẫn").fill(input.instructions);
}

test.describe("CTMS-53 Create Checkpoints on Route", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(90_000);
	const ownerEmail = email("checkpoint-owner");
	const otherHostEmail = email("checkpoint-other-host");
	const camperEmail = email("checkpoint-camper");
	let ownerId = "";
	let campsiteId = "";
	let draftRouteId = "";
	let activeRouteId = "";
	const routeIds: string[] = [];
	const campsiteName = `E2E Checkpoint Camp ${Date.now()}`;
	const draftRouteName = `E2E Draft Checkpoint Route ${Date.now()}`;
	const activeRouteName = `E2E Active Checkpoint Route ${Date.now()}`;

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
			campsites: [{ name: campsiteName, province: "CTMS53E2E", status: "draft" }],
		}).campsites[0].id;
		const seeded = db<{ routes: Array<{ id: string; status: string }> }>("seed-trekking-routes", {
			campsiteId,
			routes: [
				{ name: draftRouteName, status: "draft" },
				{ name: activeRouteName, status: "active" },
			],
		}).routes;
		draftRouteId = seeded[0].id;
		activeRouteId = seeded[1].id;
		routeIds.push(draftRouteId, activeRouteId);
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
		for (const userEmail of [ownerEmail, otherHostEmail, camperEmail]) {
			try {
				dbPlain("clean-user", userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("Host follows the campsite journey and reads multiple checkpoints back in route order", async ({
		page,
	}) => {
		await login(page, ownerEmail);
		const campsiteRow = page.getByRole("row").filter({ hasText: campsiteName });
		await expect(campsiteRow).toBeVisible();
		await campsiteRow.getByRole("button", { name: "Xem tuyến đường" }).click();
		await expect(page).toHaveURL(new RegExp(`/host/trekking-routes\\?campsiteId=${campsiteId}`));
		await page.getByRole("button", { name: new RegExp(draftRouteName) }).click();
		await expect(page.getByTestId("route-checkpoints-panel")).toBeVisible();

		await clickCheckpointMap(page, 0.7, 0.5);
		await fillCheckpoint(page, {
			name: "E2E Later Water",
			type: "water",
			offset: "80",
			instructions: "Refill water bottles",
		});
		await page.getByRole("button", { name: "Tạo checkpoint" }).click();
		await expect(page.getByText("E2E Later Water")).toBeVisible();

		await clickCheckpointMap(page, 0.3, 0.5);
		await fillCheckpoint(page, {
			name: "E2E Earlier Rest",
			type: "rest",
			offset: "30",
			instructions: "Take a short rest",
		});
		await page.getByRole("button", { name: "Tạo checkpoint" }).click();
		await expect(page.getByText("E2E Earlier Rest")).toBeVisible();

		await page.reload();
		await page.getByRole("button", { name: new RegExp(draftRouteName) }).click();
		await expect(page.getByText("E2E Earlier Rest")).toBeVisible();
		const listItems = page
			.getByRole("list", { name: "Danh sách checkpoint" })
			.getByRole("listitem");
		await expect(listItems).toHaveCount(2);
		expect(await listItems.nth(0).textContent()).toContain("E2E Earlier Rest");
		expect(await listItems.nth(1).textContent()).toContain("E2E Later Water");
		await expect(listItems.nth(0)).toContainText("Take a short rest");
		await expect(listItems.nth(1)).toContainText("Bán kính 30 m");

		const stored = db<{ checkpoints: Array<{ name: string; routePosition: number }> }>(
			"get-route-checkpoints",
			{ routeId: draftRouteId }
		);
		expect(stored.checkpoints.map((item) => item.name)).toEqual([
			"E2E Earlier Rest",
			"E2E Later Water",
		]);
		expect(Number(stored.checkpoints[0].routePosition)).toBeLessThan(
			Number(stored.checkpoints[1].routePosition)
		);
	});

	test("invalid form and ineligible route stay non-mutating", async ({ page }) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByRole("button", { name: new RegExp(draftRouteName) }).click();
		await page.getByRole("button", { name: "Tạo checkpoint" }).click();
		await expect(page.getByText("Tên checkpoint là bắt buộc")).toBeVisible();

		await page.getByRole("button", { name: new RegExp(activeRouteName) }).click();
		await expect(page.getByText(/Chỉ xem/)).toBeVisible();
		await expect(page.getByRole("button", { name: "Tạo checkpoint" })).toBeDisabled();
	});

	test("far location is rejected and the entered form remains intact", async ({ page }) => {
		await login(page, ownerEmail);
		await page.goto(`/host/trekking-routes?campsiteId=${campsiteId}`);
		await page.getByRole("button", { name: new RegExp(draftRouteName) }).click();
		await clickCheckpointMap(page, 0.5, 0, 5);
		await fillCheckpoint(page, {
			name: "E2E Far Point",
			type: "rest",
			offset: "40",
			instructions: "This must not persist",
		});
		await page.getByRole("button", { name: "Tạo checkpoint" }).click();
		await expect(page.getByRole("alert").filter({ hasText: /50 meters|50 mét/ })).toBeVisible();
		await expect(page.getByLabel("Tên checkpoint")).toHaveValue("E2E Far Point");
		expect(
			db<{ checkpoints: Array<{ name: string }> }>("get-route-checkpoints", {
				routeId: draftRouteId,
			}).checkpoints.some((item) => item.name === "E2E Far Point")
		).toBe(false);
	});

	test("foreign Host and non-Host API attempts are forbidden", async ({ page }) => {
		for (const accountEmail of [otherHostEmail, camperEmail]) {
			await login(page, accountEmail);
			const token = await page.evaluate(() => localStorage.getItem("accessToken"));
			const response = await page.request.post(
				`http://localhost:3000/api/trekking-routes/${draftRouteId}/checkpoints`,
				{
					headers: { Authorization: `Bearer ${token}` },
					data: {
						name: "E2E Forbidden",
						location: { type: "Point", coordinates: [108.46, 11.94] },
						radiusMeters: 30,
						type: "rest",
						expectedArrivalOffset: 45,
						instructions: "Must not persist",
						nearbyWaterOrShelter: false,
					},
				}
			);
			expect(response.status()).toBe(403);
		}
	});
});

import { execSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const PASSWORD = "S3curePass!";

function uniqueTag(prefix: string) {
	return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function uniqueEmail(prefix: string) {
	return `e2e-${uniqueTag(prefix)}@example.com`;
}

function uniquePhone() {
	const timestamp = Date.now().toString().slice(-3);
	const random = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");

	return `09${timestamp}${random}`;
}

function runDbHelper(action: string, arg: string): Record<string, unknown> {
	const command = `pnpm --filter @ctms/api exec ts-node src/seeds/db-helper.ts ${action} ${arg}`;

	const stdout = execSync(command, {
		cwd: WORKSPACE_ROOT,
	}).toString();

	return JSON.parse(stdout) as Record<string, unknown>;
}

function runDbHelperJson<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");

	return runDbHelper(action, encoded) as T;
}

async function login(page: Page, email: string): Promise<void> {
	await page.goto("/login");

	await page.locator('input[type="text"]').first().fill(email);

	await page.locator('input[type="password"]').first().fill(PASSWORD);

	await page.locator('form button[type="submit"]').click();

	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

async function fillValidCreateForm(page: Page, province: string) {
	await page.getByLabel("Tên campsite *").fill(`E2E Pine Camp ${province}`);

	await page.getByLabel("Mô tả *").fill("CTMS-10-T02 E2E campsite");

	await page.getByLabel("Tỉnh/Thành phố *").selectOption(province);

	await page.getByLabel("Địa điểm campsite *").fill(`Pine Camp ${province}`);

	await page.getByRole("button", { name: "Bản đồ campsite" }).press("Enter");

	await expect(page.getByTestId("selected-location")).toBeVisible();

	await page.getByLabel("Chính sách *").fill("No campfires after 21:00.");

	await page.getByLabel("Giờ mở cửa *").fill("08:00");

	await page.getByLabel("Giờ đóng cửa *").fill("18:00");

	await page.getByLabel("Chọn ảnh từ thiết bị").setInputFiles({
		name: "e2e-create-campsite.jpg",
		mimeType: "image/jpeg",
		buffer: Buffer.from("fake image"),
	});

	await expect(page.getByAltText("Ảnh campsite 1")).toBeVisible();
}

test.describe("Create Campsite CTMS-10-T02", () => {
	test.describe.configure({
		mode: "serial",
	});

	test.setTimeout(60_000);

	const hostEmail = uniqueEmail("create-host");
	const hostPhone = uniquePhone();

	const camperEmail = uniqueEmail("create-camper");

	const camperPhone = uniquePhone();

	const validProvince = "Lâm Đồng";

	const invalidProvince = "Đà Nẵng";

	let createdCampsiteId: string | null = null;

	test.beforeAll(() => {
		runDbHelperJson("create-account", {
			email: hostEmail,
			phone: hostPhone,
			password: PASSWORD,
			role: "host",
			status: "active",
		});

		runDbHelperJson("create-account", {
			email: camperEmail,
			phone: camperPhone,
			password: PASSWORD,
			role: "camper",
			status: "active",
		});
	});

	test.afterAll(() => {
		try {
			if (createdCampsiteId) {
				runDbHelperJson("clean-campsites", {
					hostIds: [],
					campsiteIds: [createdCampsiteId],
				});
			}
		} catch (error) {
			console.error("Created campsite cleanup failed:", error);
		}

		try {
			runDbHelper("clean-user", hostEmail);
		} catch (error) {
			console.error("Host cleanup failed:", error);
		}

		try {
			runDbHelper("clean-user", camperEmail);
		} catch (error) {
			console.error("Camper cleanup failed:", error);
		}
	});

	test("Host creates a valid campsite and pending approval status is persisted", async ({
		page,
	}) => {
		await login(page, hostEmail);

		await page.goto("/host/campsites/create");

		await expect(
			page.getByRole("heading", {
				name: "Tạo Campsite",
			})
		).toBeVisible();

		const beforeCreate = runDbHelperJson("count-campsites-json", {
			province: validProvince,
		}) as {
			count: number;
		};

		await fillValidCreateForm(page, validProvince);

		await page
			.getByRole("button", {
				name: "Tạo campsite",
			})
			.click();

		await expect(page.getByText("Tạo campsite thành công")).toBeVisible();

		await expect(page.getByText("pending", { exact: true })).toBeVisible();

		createdCampsiteId =
			(await page.getByTestId("created-campsite-id").textContent())?.trim() ?? null;

		expect(createdCampsiteId).toBeTruthy();

		const persisted = runDbHelperJson("count-campsites-json", {
			province: validProvince,
		}) as {
			count: number;
		};

		expect(persisted.count).toBe(beforeCreate.count + 1);

		const created = runDbHelperJson("get-campsite", {
			campsiteId: createdCampsiteId,
		}) as {
			campsite: { name: string; province: string; status: string } | null;
		};

		expect(created.campsite).toMatchObject({
			name: `E2E Pine Camp ${validProvince}`,
			province: validProvince,
			status: "pending_approval",
		});
	});

	test("invalid UI data does not create a campsite", async ({ page }) => {
		await login(page, hostEmail);

		await page.goto("/host/campsites/create");

		const beforeInvalidSubmit = runDbHelperJson("count-campsites-json", {
			province: invalidProvince,
		}) as {
			count: number;
		};

		await page.getByLabel("Tỉnh/Thành phố *").selectOption(invalidProvince);

		await page
			.getByRole("button", {
				name: "Tạo campsite",
			})
			.click();

		await expect(page.getByText("Tên campsite là bắt buộc")).toBeVisible();

		const persisted = runDbHelperJson("count-campsites-json", {
			province: invalidProvince,
		}) as {
			count: number;
		};

		expect(persisted.count).toBe(beforeInvalidSubmit.count);
	});

	test("Camper cannot access Create Campsite", async ({ page }) => {
		await login(page, camperEmail);

		await page.goto("/host/campsites/create");

		await expect(page.getByText("Truy cập bị từ chối")).toBeVisible();

		await expect(
			page.getByRole("heading", {
				name: "Tạo Campsite",
			})
		).not.toBeVisible();
	});
});

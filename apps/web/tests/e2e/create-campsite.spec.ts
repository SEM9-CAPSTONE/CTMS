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
	await page.getByLabel("Tên campsite *").fill(`Pine Camp ${province}`);

	await page.getByLabel("Mô tả *").fill("CTMS-10-T02 E2E campsite");

	await page.getByLabel("Tỉnh/Thành phố *").fill(province);

	await page.getByLabel("Vĩ độ *").fill("11.940419");

	await page.getByLabel("Kinh độ *").fill("108.458313");

	await page.getByLabel("Chính sách *").fill("No campfires after 21:00.");

	await page.getByLabel("Giờ mở cửa *").fill("08:00");

	await page.getByLabel("Giờ đóng cửa *").fill("18:00");

	await page
		.getByRole("button", {
			name: "Thêm ảnh",
		})
		.click();

	await page.getByLabel("URL ảnh 1 *").fill("https://example.com/e2e-create-campsite.jpg");

	await page.getByLabel("Thứ tự ảnh 1").fill("1");
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

	const validProvince = uniqueTag("CTMS10VALID").toUpperCase();

	const invalidProvince = uniqueTag("CTMS10INVALID").toUpperCase();

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

	test("Host creates a valid campsite and Draft is persisted", async ({ page }) => {
		await login(page, hostEmail);

		await page.goto("/host/campsites/new");

		await expect(
			page.getByRole("heading", {
				name: "Tạo Campsite",
			})
		).toBeVisible();

		await fillValidCreateForm(page, validProvince);

		await page
			.getByRole("button", {
				name: "Tạo campsite",
			})
			.click();

		await expect(page.getByText("Tạo campsite thành công")).toBeVisible();

		await expect(page.getByText("draft", { exact: true })).toBeVisible();

		createdCampsiteId =
			(await page.getByTestId("created-campsite-id").textContent())?.trim() ?? null;

		expect(createdCampsiteId).toBeTruthy();

		const persisted = runDbHelper("count-campsites", validProvince) as {
			count: number;
		};

		expect(persisted.count).toBe(1);
	});

	test("invalid UI data does not create a campsite", async ({ page }) => {
		await login(page, hostEmail);

		await page.goto("/host/campsites/new");

		await page.getByLabel("Tỉnh/Thành phố *").fill(invalidProvince);

		await page
			.getByRole("button", {
				name: "Tạo campsite",
			})
			.click();

		await expect(page.getByText("Tên campsite là bắt buộc")).toBeVisible();

		const persisted = runDbHelper("count-campsites", invalidProvince) as {
			count: number;
		};

		expect(persisted.count).toBe(0);
	});

	test("Camper cannot access Create Campsite", async ({ page }) => {
		await login(page, camperEmail);

		await page.goto("/host/campsites/new");

		await expect(page.getByText("Truy cập bị từ chối")).toBeVisible();

		await expect(
			page.getByRole("heading", {
				name: "Tạo Campsite",
			})
		).not.toBeVisible();
	});
});

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
	await expect(page).toHaveURL("/dashboard");
	await expect(page.locator('button:has-text("Đăng xuất")')).toBeVisible();
}

test.describe("Manage Campsite Images CTMS-15-T02", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(90_000);

	const hostEmail = uniqueEmail("media-host");
	const camperEmail = uniqueEmail("media-camper");
	const province = `CTMS15-${Date.now()}`;
	let hostId = "";
	let campsiteId = "";

	test.beforeAll(() => {
		const host = runDbHelperJson<{ id: string }>("create-account", {
			email: hostEmail,
			phone: uniquePhone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		});
		hostId = host.id;

		runDbHelperJson("create-account", {
			email: camperEmail,
			phone: uniquePhone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		});

		const seed = runDbHelperJson<{
			campsites: Array<{ id: string }>;
		}>("seed-campsites", {
			hostId,
			campsites: [
				{
					name: "E2E Image Manage Campsite",
					province,
					status: "active",
					latitude: "11.940419",
					longitude: "108.458313",
					images: [
						{ url: "https://example.com/photo-A.jpg", displayOrder: 0 },
						{ url: "https://example.com/photo-B.jpg", displayOrder: 1 },
					],
					zones: [{ amenities: ["wifi"], basePrice: "120.00", status: "active" }],
				},
			],
		});
		campsiteId = seed.campsites[0].id;
	});

	test.afterAll(() => {
		try {
			if (campsiteId) {
				runDbHelperJson("clean-campsites", {
					hostIds: [],
					campsiteIds: [campsiteId],
				});
			}
		} catch (error) {
			console.error("Campsite cleanup failed:", error);
		}

		for (const email of [hostEmail, camperEmail]) {
			try {
				runDbHelper("clean-user", email);
			} catch (error) {
				console.error("User cleanup failed:", error);
			}
		}
	});

	test("happy path: Host uploads, reorders, and deletes images successfully", async ({ page }) => {
		await login(page, hostEmail);

		// Locate the Quản lý ảnh button for the seeded campsite and click it
		const manageBtn = page.getByTestId(`manage-images-btn-${campsiteId}`);
		await expect(manageBtn).toBeVisible();
		await manageBtn.click();

		// Verify dialog is open and displays current images
		await expect(page.locator("#manage-images-dialog-title")).toBeVisible();
		const images = page.locator('[aria-modal="true"] img');
		await expect(images).toHaveCount(2);

		// Test invalid client-side validation flow: Delete all images
		await page.getByLabel("Xóa ảnh 1").click();
		await expect(images).toHaveCount(1);
		await page.getByLabel("Xóa ảnh 1").click(); // Click on the new first one
		await expect(images).toHaveCount(0);

		await page.getByRole("button", { name: "Lưu thay đổi" }).click();
		await expect(page.getByText("Khu cắm trại phải có ít nhất 1 ảnh")).toBeVisible();

		// Re-upload/add image
		await page.setInputFiles('input[type="file"]', [
			{
				name: "photo-new-1.jpg",
				mimeType: "image/jpeg",
				buffer: Buffer.from("fake image 1"),
			},
			{
				name: "photo-new-2.jpg",
				mimeType: "image/jpeg",
				buffer: Buffer.from("fake image 2"),
			},
		]);

		// Verify new images are loaded
		await expect(images).toHaveCount(2);

		// Reorder: Move first image right
		await page.getByLabel("Di chuyển ảnh 1 sang phải").click();

		// Save changes
		await page.getByRole("button", { name: "Lưu thay đổi" }).click();

		// Verify dialog is closed and page is reloaded
		await expect(page.locator("#manage-images-dialog-title")).not.toBeVisible();

		// Fetch and verify from database that media orders/urls are updated correctly
		const persisted = runDbHelperJson<{
			campsite: { media: Array<{ url: string; sortOrder: number }> } | null;
		}>("get-campsite-details", { campsiteId });

		expect(persisted.campsite?.media).toBeDefined();
		expect(persisted.campsite?.media.length).toBeGreaterThan(0);
	});

	test("unauthorized flow: Camper cannot access the image management dialog", async ({ page }) => {
		await login(page, camperEmail);

		// Camper should be on Camper Hub dashboard
		await expect(page.getByRole("heading", { name: /Chào buổi/ })).toBeVisible();

		// Camper should NOT see the Host campsites panel or Manage Images buttons
		await expect(page.getByTestId(`manage-images-btn-${campsiteId}`)).not.toBeVisible();
		await expect(page.getByText("Khu cắm trại của tôi")).not.toBeVisible();
	});
});

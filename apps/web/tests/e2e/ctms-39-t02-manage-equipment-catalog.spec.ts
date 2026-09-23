import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

async function loginHost(page: import("@playwright/test").Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').first().fill("Host@123");
	await page.locator('form button[type="submit"]').click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

async function goToEquipmentCatalog(page: import("@playwright/test").Page): Promise<void> {
	await page.getByRole("button", { name: "Quản lý kho thiết bị" }).click();
	await expect(page).toHaveURL(/\/host\/equipment-catalog$/);
}

test.describe("Manage Equipment Catalog Host UI", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(() => {
		execSync("node node_modules/ts-node/dist/bin.js src/seeds/dev-host-route.seed.ts", {
			cwd: path.join(WORKSPACE_ROOT, "services/api"),
			stdio: "inherit",
		});
	});

	test("allows the Host to add an item and see it in their own catalog", async ({ page }) => {
		await loginHost(page);
		await goToEquipmentCatalog(page);
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();
		await expect(page).toHaveURL(/\/host\/equipment-catalog\/create$/);

		const itemName = `E2E Tent ${Date.now()}`;
		await page.getByLabel("Tên thiết bị").fill(itemName);
		await page.getByLabel("Loại thiết bị").fill("shelter");
		await page.getByLabel("Số lượng").fill("8");
		await page.getByLabel("Giá thuê mỗi ngày").fill("45000");
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();

		await expect(page.getByText("Thêm thiết bị thành công")).toBeVisible();
		await expect(page.getByTestId("server-item-status")).toHaveText("active");
		await expect(page.getByTestId("server-item-quantity")).toHaveText("8");

		await page.getByRole("button", { name: "Về Host Dashboard" }).click();
		await goToEquipmentCatalog(page);

		await expect(page.getByText(itemName)).toBeVisible();
		const card = page.getByTestId(/equipment-catalog-item-/).filter({ hasText: itemName });
		await expect(card.getByText("Đang hoạt động")).toBeVisible();
	});

	test("allows the Host to edit an existing item and see the update reflected", async ({
		page,
	}) => {
		await loginHost(page);
		await goToEquipmentCatalog(page);
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();

		const itemName = `E2E Edit Tent ${Date.now()}`;
		await page.getByLabel("Tên thiết bị").fill(itemName);
		await page.getByLabel("Loại thiết bị").fill("shelter");
		await page.getByLabel("Số lượng").fill("10");
		await page.getByLabel("Giá thuê mỗi ngày").fill("50000");
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();
		await expect(page.getByText("Thêm thiết bị thành công")).toBeVisible();

		await page.getByRole("button", { name: "Về Host Dashboard" }).click();
		await goToEquipmentCatalog(page);

		const card = page.getByTestId(/equipment-catalog-item-/).filter({ hasText: itemName });
		await card.getByRole("button", { name: "Sửa" }).click();
		await expect(page.getByRole("heading", { name: "Sửa thiết bị" })).toBeVisible();

		await page.getByLabel("Số lượng").fill("3");
		await page.getByLabel("Trạng thái").selectOption("inactive");
		await page.getByRole("button", { name: "Lưu thay đổi" }).click();

		await expect(page.getByRole("heading", { name: "Sửa thiết bị" })).toHaveCount(0);
		const updatedCard = page.getByTestId(/equipment-catalog-item-/).filter({ hasText: itemName });
		await expect(updatedCard.getByText("Số lượng: 3")).toBeVisible();
		await expect(updatedCard.getByText("Ngừng hoạt động")).toBeVisible();
	});

	test("shows validation error for a negative quantity without creating a false-success state", async ({
		page,
	}) => {
		await loginHost(page);
		await goToEquipmentCatalog(page);
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();

		await page.getByLabel("Tên thiết bị").fill("Invalid quantity tent");
		await page.getByLabel("Loại thiết bị").fill("shelter");
		await page.getByLabel("Số lượng").fill("-1");
		await page.getByLabel("Giá thuê mỗi ngày").fill("50000");
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();

		await expect(page.getByText("Số lượng không được âm")).toBeVisible();
		await expect(page.getByText("Thêm thiết bị thành công")).toHaveCount(0);
	});
});

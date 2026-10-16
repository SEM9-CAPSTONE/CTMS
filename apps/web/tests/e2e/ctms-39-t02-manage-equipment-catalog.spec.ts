import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

async function loginHost(page: Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').first().fill("Host@123");
	await page.locator('form button[type="submit"]').click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

async function goToEquipmentCatalog(page: Page): Promise<void> {
	await page.getByRole("button", { name: "Quản lý kho thiết bị" }).click();
	await expect(page).toHaveURL(/\/host\/equipment-catalog$/);
}

/** Opens the create modal on the catalog page; the URL must not change (no separate page). */
async function openCreateModal(page: Page) {
	await page.getByRole("button", { name: "Thêm thiết bị" }).click();
	const dialog = page.getByRole("dialog", { name: "Thêm thiết bị vào kho" });
	await expect(dialog).toBeVisible();
	await expect(page).toHaveURL(/\/host\/equipment-catalog$/);
	return dialog;
}

async function createItem(
	page: Page,
	item: { name: string; quantity: string; price: string }
): Promise<void> {
	const dialog = await openCreateModal(page);
	await dialog.getByLabel("Tên thiết bị").fill(item.name);
	await dialog.getByLabel("Loại thiết bị").fill("shelter");
	await dialog.getByLabel("Số lượng").fill(item.quantity);
	await dialog.getByLabel("Giá thuê mỗi ngày").fill(item.price);
	await dialog.getByRole("button", { name: "Thêm thiết bị", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByText("Thêm thiết bị thành công")).toBeVisible();
}

test.describe("Manage Equipment Catalog Host UI", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(() => {
		// dev-host-route.seed.ts was folded into main.seed.ts; seed only the Host account here,
		// never the full --fresh master seed (which would wipe the database).
		const seedHost =
			'import { seedDevHostAndRoute } from "./src/seeds/main.seed"; import dataSource from "./src/shared/database/data-source"; seedDevHostAndRoute().finally(() => dataSource.destroy());';
		execFileSync(process.execPath, ["node_modules/ts-node/dist/bin.js", "-e", seedHost], {
			cwd: path.join(WORKSPACE_ROOT, "services/api"),
			stdio: "inherit",
		});
	});

	test("allows the Host to add an item from a modal and see it in their own catalog", async ({
		page,
	}) => {
		await loginHost(page);
		await goToEquipmentCatalog(page);

		const itemName = `E2E Tent ${Date.now()}`;
		await createItem(page, { name: itemName, quantity: "8", price: "45000" });

		// The list reloads in place from the server (newest first), so the new row is on page 1.
		const row = page.getByTestId(/equipment-catalog-item-/).filter({ hasText: itemName });
		await expect(row).toBeVisible();
		await expect(row.getByText("Đang hoạt động")).toBeVisible();
		await expect(row.getByRole("cell", { name: "8", exact: true })).toBeVisible();
		await expect(row).toContainText(/45\.000\s*₫/);
	});

	test("allows the Host to edit an existing item and see the update reflected", async ({
		page,
	}) => {
		await loginHost(page);
		await goToEquipmentCatalog(page);

		const itemName = `E2E Edit Tent ${Date.now()}`;
		await createItem(page, { name: itemName, quantity: "10", price: "50000" });

		const row = page.getByTestId(/equipment-catalog-item-/).filter({ hasText: itemName });
		await row.getByRole("button", { name: "Sửa" }).click();
		const dialog = page.getByRole("dialog", { name: "Sửa thiết bị" });
		await expect(dialog).toBeVisible();

		await dialog.getByLabel("Số lượng").fill("3");
		await dialog.getByLabel("Trạng thái").selectOption("inactive");
		await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();

		await expect(dialog).toHaveCount(0);
		const updatedRow = page.getByTestId(/equipment-catalog-item-/).filter({ hasText: itemName });
		await expect(updatedRow.getByRole("cell", { name: "3", exact: true })).toBeVisible();
		await expect(updatedRow).toContainText(/50\.000\s*₫/);
		await expect(updatedRow.getByText("Ngừng hoạt động")).toBeVisible();
	});

	test("shows validation error for a negative quantity without creating a false-success state", async ({
		page,
	}) => {
		await loginHost(page);
		await goToEquipmentCatalog(page);
		const dialog = await openCreateModal(page);

		await dialog.getByLabel("Tên thiết bị").fill("Invalid quantity tent");
		await dialog.getByLabel("Loại thiết bị").fill("shelter");
		await dialog.getByLabel("Số lượng").fill("-1");
		await dialog.getByLabel("Giá thuê mỗi ngày").fill("50000");
		await dialog.getByRole("button", { name: "Thêm thiết bị", exact: true }).click();

		await expect(dialog.getByText("Số lượng không được âm")).toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(page.getByText("Thêm thiết bị thành công")).toHaveCount(0);
	});
});

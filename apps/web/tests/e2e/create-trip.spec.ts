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

test.describe("Create Trip Host UI", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(() => {
		execSync("node node_modules/ts-node/dist/bin.js src/seeds/dev-host-route.seed.ts", {
			cwd: path.join(WORKSPACE_ROOT, "services/api"),
			stdio: "inherit",
		});
	});

	test("allows the intended Host to create a draft Trip from an approved route", async ({
		page,
	}) => {
		await loginHost(page);
		await page.getByRole("button", { name: /Tạo trip/ }).click();

		await expect(page).toHaveURL(/\/host\/trips\/create$/);
		await expect(page.getByText("Chọn tuyến đã duyệt để tạo trip")).toBeVisible();
		await expect(page.getByTestId("trip-route-map")).toBeVisible();
		await expect(page.getByLabel("URL ảnh bìa")).toHaveCount(0);
		await expect(page.getByLabel("Ảnh bìa")).toHaveAttribute("type", "file");
		await expect(page.getByLabel("Bắt đầu")).toHaveAttribute("min", /.+/);

		await page.getByLabel("Tuyến đã duyệt").selectOption({ index: 1 });
		await page.getByLabel("Tên trip").fill(`E2E Bidoup ${Date.now()}`);
		await page.getByLabel("Loại trip").selectOption("day_trip");
		await page.getByLabel("Bắt đầu").fill("2026-10-01T09:00");
		await expect(page.getByLabel("Kết thúc")).toHaveAttribute("min", "2026-10-01T09:00");
		await page.getByLabel("Kết thúc").fill("2026-10-01T17:00");
		await page.getByLabel("Thời gian tập trung").fill("2026-10-01T08:30");
		await page.getByLabel("Hạn đặt chỗ").fill("2026-09-30T09:00");
		await page.getByLabel("Số khách tối thiểu").fill("2");
		await page.getByLabel("Số khách tối đa").fill("12");
		await page.getByLabel("Giá mỗi người").fill("0");

		await page.getByRole("button", { name: "Tạo trip draft" }).click();
		await expect(page.getByRole("button", { name: /Đang tạo trip/ })).toBeDisabled();
		await expect(page.getByText("Tạo trip thành công")).toBeVisible();
		await expect(page.getByTestId("server-trip-status")).toHaveText("draft");
		await expect(page.getByTestId("server-seats-taken")).toHaveText("0");
	});

	test("shows date validation without creating a false-success state", async ({ page }) => {
		await loginHost(page);
		await page.getByRole("button", { name: /Tạo trip/ }).click();
		await page.getByLabel("Tuyến đã duyệt").selectOption({ index: 1 });
		await page.getByLabel("Tên trip").fill("Invalid schedule");
		await page.getByLabel("Bắt đầu").fill("2026-10-01T09:00");
		await page.getByLabel("Kết thúc").fill("2026-10-01T08:00");
		await page.getByLabel("Hạn đặt chỗ").fill("2026-10-01T10:00");

		await page.getByRole("button", { name: "Tạo trip draft" }).click();

		await expect(page.getByText("Thời gian kết thúc phải sau thời gian bắt đầu")).toBeVisible();
		await expect(page.getByText("Tạo trip thành công")).toHaveCount(0);
	});

	test("blocks a day trip that ends on another date", async ({ page }) => {
		await loginHost(page);
		await page.getByRole("button", { name: /Tạo trip/ }).click();
		await page.getByLabel("Tuyến đã duyệt").selectOption({ index: 1 });
		await page.getByLabel("Tên trip").fill("Invalid day trip");
		await page.getByLabel("Loại trip").selectOption("day_trip");
		await page.getByLabel("Bắt đầu").fill("2026-10-01T09:00");
		await page.getByLabel("Kết thúc").fill("2026-10-02T17:00");
		await page.getByLabel("Thời gian tập trung").fill("2026-10-01T08:30");
		await page.getByLabel("Hạn đặt chỗ").fill("2026-09-30T09:00");
		await page.getByLabel("Số khách tối thiểu").fill("2");
		await page.getByLabel("Số khách tối đa").fill("");
		await page.getByLabel("Giá mỗi người").fill("0");

		await page.getByRole("button", { name: "Tạo trip draft" }).click();

		await expect(
			page.getByText("Trip trong ngày phải bắt đầu và kết thúc trong cùng một ngày")
		).toBeVisible();
		await expect(page.getByText("Tạo trip thành công")).toHaveCount(0);
	});
});

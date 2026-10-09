import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const SEEDED_ROUTE_NAME = "Đỉnh Núi Bidoup Trail";
const CREATE_DRAFT_BUTTON_NAME = "Bước tiếp theo";

async function loginHost(page: import("@playwright/test").Page): Promise<void> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').first().fill("Host@123");
	await page.locator('form button[type="submit"]').click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

async function openCreateTripPage(page: import("@playwright/test").Page): Promise<void> {
	await page.getByRole("button", { name: "Tạo chuyến đi", exact: true }).click();
	await expect(page).toHaveURL(/\/host\/trips\/create$/);
}

async function selectMeetingPoint(page: import("@playwright/test").Page): Promise<void> {
	const map = page.getByRole("region", { name: "Map" });
	await expect(map).toBeVisible();
	await map.click({ position: { x: 210, y: 210 } });
	await expect(page.getByText(/Điểm tập trung: -?\d/)).toBeVisible();
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
		await openCreateTripPage(page);

		await expect(page.getByText("Chọn tuyến đã duyệt để tạo trip")).toBeVisible();
		await expect(page.getByTestId("trip-route-map")).toBeVisible();
		await expect(page.getByLabel("URL ảnh bìa")).toHaveCount(0);
		await expect(page.getByLabel("Ảnh bìa")).toHaveAttribute("type", "file");
		await expect(page.getByLabel("Bắt đầu")).toHaveAttribute("min", /.+/);

		await page.getByLabel("Tuyến đã duyệt").selectOption({ label: SEEDED_ROUTE_NAME });
		await selectMeetingPoint(page);
		await page.getByLabel("Tên trip").fill(`E2E Bidoup ${Date.now()}`);
		await page.getByLabel("Bắt đầu").fill("2026-11-01T09:00");
		await expect(page.getByLabel("Kết thúc")).toHaveAttribute("min", "2026-11-01T09:00");
		await page.getByLabel("Kết thúc").fill("2026-11-01T17:00");
		await page.getByRole("textbox", { name: "Thời gian tập trung" }).fill("2026-11-01T08:30");
		await page.getByRole("textbox", { name: "Hạn đặt chỗ" }).fill("2026-10-31T09:00");
		await page.getByLabel("Số khách tối thiểu").fill("2");
		await page.getByLabel("Số khách tối đa").fill("12");
		await page.getByLabel("Giá mỗi người").fill("0");

		await page.getByRole("button", { name: CREATE_DRAFT_BUTTON_NAME }).click();
		await expect(page.getByRole("heading", { name: "Lịch trình chuyến đi" })).toBeVisible();

		await page.getByRole("button", { name: "Gửi duyệt" }).click();

		await expect(page.getByTestId("configure-trip-status")).toHaveText("Chờ duyệt");
		await expect(page.getByText(/Lịch trình đã được lưu/)).toBeVisible();
	});

	test("shows date validation without creating a false-success state", async ({ page }) => {
		await loginHost(page);
		await openCreateTripPage(page);
		await page.getByLabel("Tuyến đã duyệt").selectOption({ label: SEEDED_ROUTE_NAME });
		await selectMeetingPoint(page);
		await page.getByLabel("Tên trip").fill("Invalid schedule");
		await page.getByLabel("Bắt đầu").fill("2026-11-01T09:00");
		await page.getByLabel("Kết thúc").fill("2026-11-01T08:00");
		await page.getByRole("textbox", { name: "Hạn đặt chỗ" }).fill("2026-11-01T10:00");

		await page.getByRole("button", { name: CREATE_DRAFT_BUTTON_NAME }).click();

		await expect(
			page.getByText("Thời gian bắt đầu không được sau thời gian kết thúc")
		).toBeVisible();
		await expect(page.getByRole("heading", { name: "Lịch trình chuyến đi" })).toHaveCount(0);
	});

	test("derives an overnight Trip when the schedule spans another date", async ({ page }) => {
		await loginHost(page);
		await openCreateTripPage(page);
		await page.getByLabel("Tuyến đã duyệt").selectOption({ label: SEEDED_ROUTE_NAME });
		await selectMeetingPoint(page);
		await page.getByLabel("Tên trip").fill(`E2E Overnight ${Date.now()}`);
		await page.getByLabel("Bắt đầu").fill("2026-11-01T09:00");
		await page.getByLabel("Kết thúc").fill("2026-11-02T17:00");
		await page.getByRole("textbox", { name: "Thời gian tập trung" }).fill("2026-11-01T08:30");
		await page.getByRole("textbox", { name: "Hạn đặt chỗ" }).fill("2026-10-31T09:00");
		await page.getByLabel("Số khách tối thiểu").fill("2");
		await page.getByLabel("Số khách tối đa").fill("");
		await page.getByLabel("Giá mỗi người").fill("0");

		await expect(page.getByText("Qua đêm")).toBeVisible();
		await page.getByRole("button", { name: CREATE_DRAFT_BUTTON_NAME }).click();

		await expect(page.getByRole("heading", { name: "Lịch trình chuyến đi" })).toBeVisible();
	});
});

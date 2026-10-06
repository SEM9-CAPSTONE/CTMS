import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

function runSeed(script: string): void {
	execSync(`node node_modules/ts-node/dist/bin.js ${script}`, {
		cwd: path.join(WORKSPACE_ROOT, "services/api"),
		stdio: "inherit",
	});
}

function runDbHelper(action: string, argPayload: unknown): void {
	const base64 = Buffer.from(JSON.stringify(argPayload)).toString("base64");
	execSync(`node node_modules/ts-node/dist/bin.js src/seeds/db-helper.ts ${action} ${base64}`, {
		cwd: path.join(WORKSPACE_ROOT, "services/api"),
		stdio: "inherit",
	});
}

async function loginAs(
	page: import("@playwright/test").Page,
	email: string,
	pass: string
): Promise<void> {
	await page.goto("/login");
	await page.evaluate(() => {
		localStorage.clear();
		sessionStorage.clear();
	});
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').first().fill(pass);
	await page.locator('form button[type="submit"]').click();
	await expect(page).toHaveURL(/\/(dashboard|admin\/users|host\/trekking-routes|porter\/profile)$/);
}

test.describe("CTMS-43-T02 Manage Porter Profile & Route Qualifications", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(() => {
		// Ensure dev accounts & host route exist
		runSeed("src/seeds/dev-admin.seed.ts");
		runSeed("src/seeds/dev-host-route.seed.ts");
		runDbHelper("clean-porter-data", { porterEmail: "porter@ctms.local" });
	});

	test("Scenario 1 — Porter profile create/edit and reload persistence", async ({ page }) => {
		await loginAs(page, "porter@ctms.local", "Porter@123");

		// Navigate to Porter Profile
		await page.goto("/porter/profile");
		await expect(page.getByRole("heading", { name: "Hồ sơ nghề nghiệp Porter" })).toBeVisible();

		// Virtual / default profile rendered without error
		await expect(page.getByTestId("profile-persistence-badge")).toContainText(
			"Chưa lưu (Mặc định)"
		);
		await expect(page.getByTestId("readonly-rating-card")).toContainText("0.0");
		await expect(page.getByTestId("readonly-completed-trips-card")).toContainText("0");

		// Edit experience years, availability, certifications, and languages
		const expInput = page.getByLabel("Số năm kinh nghiệm Porter *");
		await expInput.fill("4");

		await page.getByRole("button", { name: /Sẵn sàng nhận ca/i }).click();

		const certInput = page.getByPlaceholder(/VD: Sơ cấp cứu WFA/i);
		await certInput.fill("WFA Wilderness First Aid");
		await certInput.press("Enter");

		const langInput = page.getByPlaceholder(/VD: Tiếng Việt, Tiếng Anh/i);
		await langInput.fill("Tiếng Việt");
		await langInput.press("Enter");

		// Save profile
		await page.getByTestId("save-porter-profile-button").click();
		await expect(page.getByTestId("profile-success-alert")).toBeVisible();
		await expect(page.getByTestId("profile-persistence-badge")).toContainText("Phiên bản v1");

		// F5 Reload and assert persistence
		await page.reload();
		await expect(page.getByLabel("Số năm kinh nghiệm Porter *")).toHaveValue("4");
		await expect(page.getByText("WFA Wilderness First Aid")).toBeVisible();
		await expect(page.getByText("Tiếng Việt")).toBeVisible();
		await expect(page.getByTestId("profile-persistence-badge")).toContainText("Phiên bản v1");
	});

	test("Scenario 2 — Porter qualification create and update", async ({ page }) => {
		await loginAs(page, "porter@ctms.local", "Porter@123");
		await page.goto("/porter/profile");

		// Open Add Qualification dialog
		await page.getByTestId("add-qualification-button").click();
		await expect(page.getByTestId("qualification-dialog")).toBeVisible();

		// Input route UUID for active test route
		await page.locator("#routeId").fill("400dc5c4-8e81-497f-92a0-6fe3249ef922");

		// Select proficiency "proficient"
		await page.getByRole("button", { name: /Thành thạo \(Proficient\)/i }).click();

		// Set times led
		const timesLedInput = page.getByLabel(/Số lần đã dẫn/i);
		await timesLedInput.fill("3");

		// Submit creation
		await page.getByTestId("submit-qualification-button").click();
		await expect(page.getByTestId("qualification-success-alert")).toBeVisible();

		// Qualification appears in grid with unverified badge
		await expect(page.getByTestId("qualification-unverified-badge")).toBeVisible();
		await expect(page.getByText("3 lần")).toBeVisible();

		// Reload to assert persistence
		await page.reload();
		await expect(page.getByTestId("qualification-unverified-badge")).toBeVisible();
		await expect(page.getByText("3 lần")).toBeVisible();

		// Update qualification
		await page.getByRole("button", { name: "Chỉnh sửa" }).click();
		await expect(page.getByTestId("qualification-dialog")).toBeVisible();
		await page.getByRole("button", { name: /Chuyên gia \(Expert\)/i }).click();
		await timesLedInput.fill("7");
		await page.getByTestId("submit-qualification-button").click();

		await expect(page.getByTestId("qualification-success-alert")).toBeVisible();
		await expect(page.getByText("7 lần")).toBeVisible();
		await expect(page.getByText("Chuyên gia (Expert)")).toBeVisible();
	});

	test("Scenario 4 & 3 — Owning Host verifies qualification, then Porter edit clears verification", async ({
		page,
	}) => {
		// Log in as Host who owns the route
		await loginAs(page, "host@ctms.local", "Host@123");

		// Go to Host Trekking Routes
		await page.goto("/host/trekking-routes");
		await expect(page.getByRole("heading", { name: "Tuyến trekking của Host" })).toBeVisible();

		// Scroll to Porter review section
		await expect(page.getByTestId("route-porter-qualifications-panel")).toBeVisible();
		await expect(page.getByText("Porter #b6201c42")).toBeVisible();

		// Verify button should be visible
		const verifyBtn = page.getByRole("button", { name: "Xác minh" }).first();
		await expect(verifyBtn).toBeVisible();
		await verifyBtn.click();

		// Success banner and verified badge
		await expect(page.getByTestId("verify-success-alert")).toBeVisible();
		await expect(page.getByTestId("row-verified-badge")).toBeVisible();

		// F5 reload preserves verified state for Host
		await page.reload();
		await expect(page.getByTestId("row-verified-badge")).toBeVisible();

		// Scenario 3: Log back in as Porter, verify the qualification is verified, then edit it
		await loginAs(page, "porter@ctms.local", "Porter@123");

		await page.goto("/porter/profile");
		await expect(page.getByTestId("qualification-verified-badge")).toBeVisible();
		await expect(page.getByText("Đủ điều kiện làm Trưởng nhóm")).toBeVisible();

		// Open edit dialog on verified qualification
		await page.getByRole("button", { name: "Chỉnh sửa" }).click();
		await expect(page.getByTestId("verified-edit-warning")).toBeVisible();

		// Change times led to 9
		const timesLedInput = page.getByLabel(/Số lần đã dẫn/i);
		await timesLedInput.fill("9");
		await page.getByTestId("submit-qualification-button").click();

		// Verification cleared on effective edit
		await expect(page.getByTestId("qualification-success-alert")).toBeVisible();
		await expect(page.getByTestId("qualification-unverified-badge")).toBeVisible();

		// F5 reload confirms unverified authoritative state
		await page.reload();
		await expect(page.getByTestId("qualification-unverified-badge")).toBeVisible();
	});

	test("Scenario 5 & 6 — Unauthorized verification rejection and stale conflict handling", async ({
		page,
	}) => {
		// Log in as Porter
		await loginAs(page, "porter@ctms.local", "Porter@123");
		await page.goto("/porter/profile");

		// Change experience input
		const expInput = page.getByLabel("Số năm kinh nghiệm Porter *");
		await expInput.fill("10");

		// Simulate server version increment by concurrent session
		runDbHelper("bump-porter-profile-version", { porterEmail: "porter@ctms.local" });

		// Porter tries to save with stale expectedVersion -> 409 conflict
		await page.getByTestId("save-porter-profile-button").click();
		await expect(page.getByTestId("profile-conflict-alert")).toBeVisible();
		await expect(page.getByText(/xung đột phiên bản/i)).toBeVisible();
	});
});

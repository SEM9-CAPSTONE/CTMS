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

test.describe("Edit Campsite Information CTMS-11-T02", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(75_000);

	const hostEmail = uniqueEmail("edit-host");
	const camperEmail = uniqueEmail("edit-camper");
	const province = `CTMS11-${Date.now()}`;
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
					name: "E2E Editable Pine Camp",
					province,
					status: "active",
					latitude: "11.940419",
					longitude: "108.458313",
					images: [{ url: "https://example.com/edit-camp.jpg", displayOrder: 0 }],
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

	test("happy path: Host edits campsite and Camper search sees updated public data", async ({
		page,
	}) => {
		await login(page, hostEmail);
		await page.goto(`/host/campsites/${campsiteId}/edit`);

		await expect(page.getByRole("heading", { name: "Chỉnh sửa Khu cắm trại" })).toBeVisible();

		await page.getByLabel("Tên khu cắm trại *").fill("E2E Updated Pine Camp");
		await page.getByLabel("Mô tả *").fill("Updated CTMS-11 campsite description");
		await page.getByLabel("Chính sách *").fill("Quiet hours after 22:00.");

		await page.getByRole("button", { name: "Lưu thay đổi" }).click();
		await expect(page.getByText("Cập nhật khu cắm trại thành công")).toBeVisible();

		const persisted = runDbHelperJson<{
			campsite: { name: string; description: string; policies: { rules: string } } | null;
		}>("get-campsite-details", { campsiteId });

		expect(persisted.campsite).toMatchObject({
			name: "E2E Updated Pine Camp",
			description: "Updated CTMS-11 campsite description",
			policies: { rules: "Quiet hours after 22:00." },
		});

		await page.evaluate(() => localStorage.clear());
		await login(page, camperEmail);
		await page.goto("/campsites");
		await expect(page.getByText(/đang tìm kiếm khu cắm trại/i)).not.toBeVisible();
		await page.getByLabel("Tỉnh/Thành").fill(province);
		await page.getByRole("button", { name: "Tìm kiếm" }).click();
		await expect(page.getByText(/đang tìm kiếm khu cắm trại/i)).not.toBeVisible();
		await expect(page.getByText("E2E Updated Pine Camp")).toBeVisible();
	});

	test("invalid-data flow: client validation blocks PATCH and data stays unchanged", async ({
		page,
	}) => {
		await login(page, hostEmail);
		await page.goto(`/host/campsites/${campsiteId}/edit`);

		const before = runDbHelperJson<{
			campsite: { name: string } | null;
		}>("get-campsite-details", { campsiteId });

		const patchRequests: string[] = [];
		page.on("request", (request) => {
			const url = new URL(request.url());
			if (request.method() === "PATCH" && url.pathname.endsWith(`/api/campsites/${campsiteId}`)) {
				patchRequests.push(request.url());
			}
		});

		await page.getByLabel("Tên khu cắm trại *").fill("");
		await page.getByRole("button", { name: "Lưu thay đổi" }).click();

		await expect(page.getByText("Tên khu cắm trại là bắt buộc")).toBeVisible();
		expect(patchRequests).toHaveLength(0);

		const after = runDbHelperJson<{
			campsite: { name: string } | null;
		}>("get-campsite-details", { campsiteId });
		expect(after.campsite?.name).toBe(before.campsite?.name);
	});

	test("unauthorized flow: Camper cannot reach Host edit and data remains unchanged", async ({
		page,
	}) => {
		await login(page, camperEmail);

		const before = runDbHelperJson<{
			campsite: { name: string } | null;
		}>("get-campsite-details", { campsiteId });
		const patchRequests: string[] = [];

		page.on("request", (request) => {
			const url = new URL(request.url());
			if (request.method() === "PATCH" && url.pathname.endsWith(`/api/campsites/${campsiteId}`)) {
				patchRequests.push(request.url());
			}
		});

		await page.goto(`/host/campsites/${campsiteId}/edit`);

		await expect(page.getByText("Truy cập bị từ chối")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Chỉnh sửa Khu cắm trại" })).not.toBeVisible();
		expect(patchRequests).toHaveLength(0);

		const after = runDbHelperJson<{
			campsite: { name: string } | null;
		}>("get-campsite-details", { campsiteId });
		expect(after.campsite?.name).toBe(before.campsite?.name);
	});
});

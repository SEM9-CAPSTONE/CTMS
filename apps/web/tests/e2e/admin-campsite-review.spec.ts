import { expect, test } from "@playwright/test";

const admin = {
	id: "admin-1",
	email: "admin@ctms.local",
	phone: null,
	fullName: "CTMS Admin",
	role: "admin",
	roles: ["admin"],
	status: "active",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const camperBase = {
	id: "user-1",
	email: "camper@example.com",
	phone: "+84912345678",
	fullName: "Nguyen Camper",
	role: "camper",
	roles: ["camper"],
	createdAt: "2026-01-02T00:00:00.000Z",
	updatedAt: "2026-01-02T00:00:00.000Z",
};

const mockCampsite = {
	id: "campsite-1",
	hostId: "host-1",
	name: "Bãi cắm trại hồ Tuyền Lâm",
	description: "Khu cắm trại ven hồ thoáng mát",
	latitude: 11.89,
	longitude: 108.45,
	province: "Lâm Đồng",
	status: "pending_approval",
	media: [{ id: "media-1", url: "http://example.com/campsite.jpg", type: "photo", sortOrder: 0 }],
	createdAt: "2026-08-25T12:00:00.000Z",
	updatedAt: "2026-08-25T12:00:00.000Z",
};

test.describe("Admin campsite review", () => {
	test("searches, views and approves a campsite request", async ({ page }) => {
		let currentStatus = "pending_approval";

		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "admin-token");
			localStorage.setItem("authUser", JSON.stringify(user));
		}, admin);

		await page.route("**/api/profiles/me", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin) })
		);

		await page.route("**/api/campsites/pending-review", async (route) => {
			if (currentStatus === "pending_approval") {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([mockCampsite]),
				});
			}
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([]),
			});
		});

		await page.route("**/api/campsites/*/review", async (route) => {
			const request = route.request();
			const body = JSON.parse(request.postData() || "{}");
			if (body.action === "approve") {
				currentStatus = "active";
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						...mockCampsite,
						status: "active",
					}),
				});
			}
			return route.fulfill({
				status: 400,
				contentType: "application/json",
				body: JSON.stringify({ message: "Invalid action" }),
			});
		});

		await page.goto("/admin/campsites");
		await expect(page.getByRole("navigation", { name: "Administration navigation" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Duyệt khu cắm trại" })).toHaveAttribute(
			"aria-current",
			"page"
		);

		await expect(page.getByText("Bãi cắm trại hồ Tuyền Lâm")).toBeVisible();
		await page.getByRole("button", { name: "Duyệt Bãi cắm trại hồ Tuyền Lâm" }).click();

		await expect(page.getByRole("dialog")).toBeVisible();
		await page.getByRole("button", { name: "Xác nhận duyệt" }).click();

		await expect(page.getByText("Đã phê duyệt hoạt động cho khu cắm trại")).toBeVisible();
		await expect(page.getByText("Chưa có bãi cắm nào được đăng ký")).toBeVisible();
	});

	test("requires decline reason client-side", async ({ page }) => {
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "admin-token");
			localStorage.setItem("authUser", JSON.stringify(user));
		}, admin);

		await page.route("**/api/profiles/me", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin) })
		);

		await page.route("**/api/campsites/pending-review", async (route) => {
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([mockCampsite]),
			});
		});

		await page.goto("/admin/campsites");
		await page.getByRole("button", { name: "Duyệt Bãi cắm trại hồ Tuyền Lâm" }).click();

		await page.getByRole("button", { name: "Từ chối" }).click();
		await page.getByRole("button", { name: "Xác nhận từ chối" }).click();

		await expect(page.getByText("Lý do từ chối là bắt buộc.")).toBeVisible();
	});

	test("blocks access for a camper role", async ({ page }) => {
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "camper-token");
			localStorage.setItem("authUser", JSON.stringify({ ...user, status: "active" }));
		}, camperBase);

		await page.goto("/admin/campsites");
		await expect(page.getByText("403 - Hạn chế quyền truy cập")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
	});
});

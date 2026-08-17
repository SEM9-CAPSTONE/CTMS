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

test.describe("Admin user accounts", () => {
	test("searches, views, locks, and unlocks an account", async ({ page }) => {
		let status: "active" | "suspended" = "active";
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "admin-token");
			localStorage.setItem("authUser", JSON.stringify(user));
		}, admin);
		await page.route("**/api/profiles/me", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin) })
		);
		await page.route("**/api/users**", async (route) => {
			const request = route.request();
			const path = new URL(request.url()).pathname;
			if (path.endsWith("/lock") && request.method() === "PATCH") status = "suspended";
			if (path.endsWith("/unlock") && request.method() === "PATCH") status = "active";
			if (path.endsWith("/user-1") || path.endsWith("/lock") || path.endsWith("/unlock")) {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						...camperBase,
						status,
						dateOfBirth: "1995-04-12",
						gender: "male",
						address: "Da Lat",
						bio: "Weekend trekker",
					}),
				});
			}
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					items: [admin, { ...camperBase, status }],
					pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
				}),
			});
		});

		await page.goto("/admin/users");
		await expect(page.getByRole("navigation", { name: "Administration navigation" })).toBeVisible();
		await expect(page.getByRole("button", { name: "User Accounts" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		await expect(page.getByRole("button", { name: /Audit Logs/ })).toBeDisabled();
		await expect(page.getByRole("button", { name: /Content Reports/ })).toBeDisabled();
		await expect(page.getByText("Nguyen Camper")).toBeVisible();
		await page.getByPlaceholder("Tên, email hoặc số điện thoại").fill("camper@example.com");
		await page.getByRole("button", { name: "Tìm kiếm" }).click();
		await page.getByRole("button", { name: "Xem Nguyen Camper" }).click();
		await expect(page.getByRole("dialog", { name: "Chi tiết tài khoản" })).toContainText(
			"Weekend trekker"
		);
		await page.getByRole("button", { name: "Đóng chi tiết" }).click();
		await page.getByRole("button", { name: "Khóa Nguyen Camper" }).click();
		await page.getByPlaceholder("Nhập lý do cho audit log").fill("Security review");
		await page.getByRole("button", { name: "Xác nhận khóa" }).click();
		await expect(page.getByText("Đã khóa tài khoản thành công.")).toBeVisible();
		await page.getByRole("button", { name: "Mở khóa Nguyen Camper" }).click();
		await page.getByRole("button", { name: "Xác nhận mở khóa" }).click();
		await expect(page.getByText("Đã mở khóa tài khoản thành công.")).toBeVisible();
	});

	test("blocks direct navigation for a non-admin before loading admin data", async ({ page }) => {
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "camper-token");
			localStorage.setItem("authUser", JSON.stringify({ ...user, status: "active" }));
		}, camperBase);
		await page.goto("/admin/users");
		await expect(page.getByText("403 - Hạn chế quyền truy cập")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
	});

	test("shows the authorization error returned by the API", async ({ page }) => {
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "admin-token");
			localStorage.setItem("authUser", JSON.stringify(user));
		}, admin);
		await page.route("**/api/profiles/me", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(admin),
			})
		);
		await page.route("**/api/users**", (route) =>
			route.fulfill({
				status: 403,
				contentType: "application/json",
				body: JSON.stringify({ statusCode: 403, message: "Admin access required" }),
			})
		);
		await page.goto("/admin/users");
		await expect(page.getByRole("alert")).toContainText("không có quyền quản lý");
	});
});

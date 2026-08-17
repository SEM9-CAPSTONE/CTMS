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

const mockAuditLogs = [
	{
		id: "log-1",
		actorId: "admin-1",
		action: "user.account_locked",
		targetType: "user",
		targetId: "user-1",
		before: { status: "active" },
		after: { status: "suspended" },
		reason: "Security check",
		createdAt: "2026-08-10T12:00:00.000Z",
	},
	{
		id: "log-2",
		actorId: "user-1",
		action: "auth.login",
		targetType: "user",
		targetId: "user-1",
		before: null,
		after: null,
		reason: null,
		createdAt: "2026-08-09T10:00:00.000Z",
	},
];

test.describe("Admin view audit logs UI", () => {
	test("navigates to audit logs workspace, applies filters, and views log details", async ({
		page,
	}) => {
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "admin-token");
			localStorage.setItem("authUser", JSON.stringify(user));
		}, admin);

		await page.route("**/api/profiles/me", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin) })
		);

		let lastParams: Record<string, string> = {};
		await page.route("**/api/audit-logs**", async (route) => {
			const urlObj = new URL(route.request().url());
			lastParams = Object.fromEntries(urlObj.searchParams.entries());

			if (lastParams.outcome === "failure") {
				return route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						items: [],
						pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
					}),
				});
			}

			let items = mockAuditLogs;
			if (lastParams.action) {
				items = mockAuditLogs.filter((l) => l.action.includes(lastParams.action));
			}

			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					items,
					pagination: {
						page: Number(lastParams.page || 1),
						limit: 20,
						total: items.length,
						totalPages: 1,
					},
				}),
			});
		});

		await page.goto("/admin/users");
		await expect(page.getByRole("navigation", { name: "Administration navigation" })).toBeVisible();

		await page.getByRole("button", { name: "Audit Logs" }).click();
		await expect(page).toHaveURL(/\/admin\/audit-logs$/);

		await expect(
			page.getByRole("heading", { name: "Nhật ký hệ thống (Audit Logs)" })
		).toBeVisible();
		await expect(page.getByText("user.account_locked")).toBeVisible();
		await expect(page.getByText("auth.login")).toBeVisible();

		const actionInput = page.locator("#filter-action");
		await actionInput.fill("locked");
		await page.getByRole("button", { name: "Tìm kiếm" }).click();

		expect(lastParams.action).toBe("locked");
		await expect(page.getByText("auth.login")).not.toBeVisible();
		await expect(page.getByText("user.account_locked")).toBeVisible();

		await page.getByRole("button", { name: "Đặt lại" }).click();
		await expect(page.getByText("auth.login")).toBeVisible();

		await page.locator("#filter-outcome").selectOption("failure");
		await page.getByRole("button", { name: "Tìm kiếm" }).click();
		await expect(page.getByText("Không tìm thấy nhật ký phù hợp")).toBeVisible();

		await page.getByRole("button", { name: "Đặt lại" }).click();

		await page.getByLabel("Xem chi tiết log log-1").click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText("Chi tiết nhật ký hệ thống")).toBeVisible();
		await expect(dialog.getByText("Security check")).toBeVisible();
		await expect(dialog.getByText("suspended")).toBeVisible();
		await expect(dialog.getByText("active")).toBeVisible();

		await page.getByRole("button", { name: "Đóng chi tiết" }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("blocks direct navigation for a non-admin to audit logs", async ({ page }) => {
		await page.addInitScript((user) => {
			localStorage.setItem("accessToken", "camper-token");
			localStorage.setItem("authUser", JSON.stringify({ ...user, status: "active" }));
		}, camperBase);

		await page.goto("/admin/audit-logs");
		await expect(page.getByText("403 - Hạn chế quyền truy cập")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
	});
});

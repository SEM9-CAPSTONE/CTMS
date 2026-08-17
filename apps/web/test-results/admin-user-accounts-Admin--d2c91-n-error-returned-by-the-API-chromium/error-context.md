# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-user-accounts.spec.ts >> Admin user accounts >> shows the authorization error returned by the API
- Location: tests\e2e\admin-user-accounts.spec.ts:99:2

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "không có quyền quản lý"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('alert')

```

# Test source

```ts
  19  | 	role: "camper",
  20  | 	roles: ["camper"],
  21  | 	createdAt: "2026-01-02T00:00:00.000Z",
  22  | 	updatedAt: "2026-01-02T00:00:00.000Z",
  23  | };
  24  | 
  25  | test.describe("Admin user accounts", () => {
  26  | 	test("searches, views, locks, and unlocks an account", async ({ page }) => {
  27  | 		let status: "active" | "suspended" = "active";
  28  | 		await page.addInitScript((user) => {
  29  | 			localStorage.setItem("accessToken", "admin-token");
  30  | 			localStorage.setItem("authUser", JSON.stringify(user));
  31  | 		}, admin);
  32  | 		await page.route("**/api/profiles/me", (route) =>
  33  | 			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admin) })
  34  | 		);
  35  | 		await page.route("**/api/users**", async (route) => {
  36  | 			const request = route.request();
  37  | 			const path = new URL(request.url()).pathname;
  38  | 			if (path.endsWith("/lock") && request.method() === "PATCH") status = "suspended";
  39  | 			if (path.endsWith("/unlock") && request.method() === "PATCH") status = "active";
  40  | 			if (path.endsWith("/user-1") || path.endsWith("/lock") || path.endsWith("/unlock")) {
  41  | 				return route.fulfill({
  42  | 					status: 200,
  43  | 					contentType: "application/json",
  44  | 					body: JSON.stringify({
  45  | 						...camperBase,
  46  | 						status,
  47  | 						dateOfBirth: "1995-04-12",
  48  | 						gender: "male",
  49  | 						address: "Da Lat",
  50  | 						bio: "Weekend trekker",
  51  | 					}),
  52  | 				});
  53  | 			}
  54  | 			return route.fulfill({
  55  | 				status: 200,
  56  | 				contentType: "application/json",
  57  | 				body: JSON.stringify({
  58  | 					items: [admin, { ...camperBase, status }],
  59  | 					pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  60  | 				}),
  61  | 			});
  62  | 		});
  63  | 
  64  | 		await page.goto("/admin/users");
  65  | 		await expect(page.getByRole("navigation", { name: "Administration navigation" })).toBeVisible();
  66  | 		await expect(page.getByRole("button", { name: "Tài khoản người dùng" })).toHaveAttribute(
  67  | 			"aria-current",
  68  | 			"page"
  69  | 		);
  70  | 		await expect(page.getByRole("button", { name: /Nhật ký hệ thống/ })).toBeEnabled();
  71  | 		await expect(page.getByRole("button", { name: /Báo cáo nội dung/ })).toBeDisabled();
  72  | 		await expect(page.getByText("Nguyen Camper")).toBeVisible();
  73  | 		await page.getByPlaceholder("Tên, email hoặc số điện thoại").fill("camper@example.com");
  74  | 		await page.getByRole("button", { name: "Tìm kiếm" }).click();
  75  | 		await page.getByRole("button", { name: "Xem Nguyen Camper" }).click();
  76  | 		await expect(page.getByRole("dialog", { name: "Chi tiết tài khoản" })).toContainText(
  77  | 			"Weekend trekker"
  78  | 		);
  79  | 		await page.getByRole("button", { name: "Đóng chi tiết" }).click();
  80  | 		await page.getByRole("button", { name: "Khóa Nguyen Camper" }).click();
  81  | 		await page.getByPlaceholder("Nhập lý do cho audit log").fill("Security review");
  82  | 		await page.getByRole("button", { name: "Xác nhận khóa" }).click();
  83  | 		await expect(page.getByText("Đã khóa tài khoản thành công.")).toBeVisible();
  84  | 		await page.getByRole("button", { name: "Mở khóa Nguyen Camper" }).click();
  85  | 		await page.getByRole("button", { name: "Xác nhận mở khóa" }).click();
  86  | 		await expect(page.getByText("Đã mở khóa tài khoản thành công.")).toBeVisible();
  87  | 	});
  88  | 
  89  | 	test("blocks direct navigation for a non-admin before loading admin data", async ({ page }) => {
  90  | 		await page.addInitScript((user) => {
  91  | 			localStorage.setItem("accessToken", "camper-token");
  92  | 			localStorage.setItem("authUser", JSON.stringify({ ...user, status: "active" }));
  93  | 		}, camperBase);
  94  | 		await page.goto("/admin/users");
  95  | 		await expect(page.getByText("403 - Hạn chế quyền truy cập")).toBeVisible();
  96  | 		await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
  97  | 	});
  98  | 
  99  | 	test("shows the authorization error returned by the API", async ({ page }) => {
  100 | 		await page.addInitScript((user) => {
  101 | 			localStorage.setItem("accessToken", "admin-token");
  102 | 			localStorage.setItem("authUser", JSON.stringify(user));
  103 | 		}, admin);
  104 | 		await page.route("**/api/profiles/me", (route) =>
  105 | 			route.fulfill({
  106 | 				status: 200,
  107 | 				contentType: "application/json",
  108 | 				body: JSON.stringify(admin),
  109 | 			})
  110 | 		);
  111 | 		await page.route("**/api/users**", (route) =>
  112 | 			route.fulfill({
  113 | 				status: 403,
  114 | 				contentType: "application/json",
  115 | 				body: JSON.stringify({ statusCode: 403, message: "Admin access required" }),
  116 | 			})
  117 | 		);
  118 | 		await page.goto("/admin/users");
> 119 | 		await expect(page.getByRole("alert")).toContainText("không có quyền quản lý");
      |                                         ^ Error: expect(locator).toContainText(expected) failed
  120 | 	});
  121 | });
  122 | 
```
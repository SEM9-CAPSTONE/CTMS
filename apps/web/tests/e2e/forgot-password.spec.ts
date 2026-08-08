import { expect, test } from "@playwright/test";

async function mockForgotPassword(page: import("@playwright/test").Page) {
	await page.route("**/api/auth/forgot-password", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				requestAccepted: true,
			}),
		});
	});
}

test.describe("Forgot password (E2E, mocked API)", () => {
	test("moves from OTP request to new-password reset and redirects to login", async ({ page }) => {
		await mockForgotPassword(page);

		await page.route("**/api/auth/reset-password", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					passwordReset: true,
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await expect(page.getByText(/Nếu tài khoản đang hoạt động/i)).toBeVisible();

		await page.getByLabel("Mã xác minh").fill("123456");
		await page.getByLabel("Mật khẩu mới").fill("NewPass123");
		await page.getByLabel("Xác nhận mật khẩu").fill("NewPass123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		await expect(page.getByText("Mật khẩu đã được đặt lại")).toBeVisible();

		await expect(page).toHaveURL(/\/login$/);
	});

	test("shows an expired-or-invalid code error without leaving the page", async ({ page }) => {
		await mockForgotPassword(page);

		await page.route("**/api/auth/reset-password", async (route) => {
			await route.fulfill({
				status: 409,
				contentType: "application/json",
				body: JSON.stringify({
					statusCode: 409,
					message: "Invalid or expired reset code",
					error: "Conflict",
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await page.getByLabel("Mã xác minh").fill("000000");
		await page.getByLabel("Mật khẩu mới").fill("NewPass123");
		await page.getByLabel("Xác nhận mật khẩu").fill("NewPass123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		await expect(
			page.getByText("Mã xác minh đã hết hạn hoặc không chính xác. Vui lòng yêu cầu mã mới.")
		).toBeVisible();

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("shows validation error when email or phone is empty", async ({ page }) => {
		let forgotPasswordCalled = false;

		await page.route("**/api/auth/forgot-password", async (route) => {
			forgotPasswordCalled = true;

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					requestAccepted: true,
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await expect(page.getByText(/Email hoặc số điện thoại.*bắt buộc/i)).toBeVisible();

		expect(forgotPasswordCalled).toBe(false);

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("shows error when password confirmation does not match", async ({ page }) => {
		await mockForgotPassword(page);

		let resetPasswordCalled = false;

		await page.route("**/api/auth/reset-password", async (route) => {
			resetPasswordCalled = true;

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					passwordReset: true,
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await page.getByLabel("Mã xác minh").fill("123456");
		await page.getByLabel("Mật khẩu mới").fill("NewPass123");

		await page.getByLabel("Xác nhận mật khẩu").fill("DifferentPass123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		await expect(page.getByText(/Mật khẩu xác nhận.*không khớp/i)).toBeVisible();

		expect(resetPasswordCalled).toBe(false);

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("shows error when forgot-password API fails", async ({ page }) => {
		await page.route("**/api/auth/forgot-password", async (route) => {
			await route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					statusCode: 500,
					message: "Internal server error",
					error: "Internal Server Error",
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await expect(
			page.getByText(/Không thể gửi mã xác minh|Đã xảy ra lỗi|Vui lòng thử lại/i)
		).toBeVisible();

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("shows rate-limit error when requesting OTP too many times", async ({ page }) => {
		await page.route("**/api/auth/forgot-password", async (route) => {
			await route.fulfill({
				status: 429,
				contentType: "application/json",
				body: JSON.stringify({
					statusCode: 429,
					message: "Too many reset requests",
					error: "Too Many Requests",
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await expect(
			page.getByText(/quá nhiều.*yêu cầu|vui lòng thử lại sau|thử lại sau/i)
		).toBeVisible();

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("does not submit reset request when verification code is empty", async ({ page }) => {
		await mockForgotPassword(page);

		let resetPasswordCalled = false;

		await page.route("**/api/auth/reset-password", async (route) => {
			resetPasswordCalled = true;

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					passwordReset: true,
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await page.getByLabel("Mật khẩu mới").fill("NewPass123");
		await page.getByLabel("Xác nhận mật khẩu").fill("NewPass123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		await expect(page.getByText(/Mã xác minh.*bắt buộc/i)).toBeVisible();

		expect(resetPasswordCalled).toBe(false);

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("rejects password that does not satisfy password policy", async ({ page }) => {
		await mockForgotPassword(page);

		let resetPasswordCalled = false;

		await page.route("**/api/auth/reset-password", async (route) => {
			resetPasswordCalled = true;

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					passwordReset: true,
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await page.getByLabel("Mã xác minh").fill("123456");
		await page.getByLabel("Mật khẩu mới").fill("123");
		await page.getByLabel("Xác nhận mật khẩu").fill("123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		await expect(
			page.getByText(/Mật khẩu.*ít nhất|Mật khẩu không hợp lệ|Mật khẩu phải/i)
		).toBeVisible();

		expect(resetPasswordCalled).toBe(false);

		await expect(page).toHaveURL(/\/forgot-password$/);
	});

	test("sends correct reset-password payload", async ({ page }) => {
		await mockForgotPassword(page);

		let requestBody: unknown;

		await page.route("**/api/auth/reset-password", async (route) => {
			requestBody = route.request().postDataJSON();

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					passwordReset: true,
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await page.getByLabel("Mã xác minh").fill("123456");
		await page.getByLabel("Mật khẩu mới").fill("NewPass123");
		await page.getByLabel("Xác nhận mật khẩu").fill("NewPass123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		expect(requestBody).toEqual({
			identifier: "camper@ctms.local",
			code: "123456",
			newPassword: "NewPass123",
		});
	});

	test("keeps the user on forgot-password page when reset API returns server error", async ({
		page,
	}) => {
		await mockForgotPassword(page);

		await page.route("**/api/auth/reset-password", async (route) => {
			await route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					statusCode: 500,
					message: "Internal server error",
					error: "Internal Server Error",
				}),
			});
		});

		await page.goto("/forgot-password");

		await page.getByLabel("Email hoặc số điện thoại").fill("camper@ctms.local");

		await page.getByRole("button", { name: "Gửi mã xác minh" }).click();

		await page.getByLabel("Mã xác minh").fill("123456");
		await page.getByLabel("Mật khẩu mới").fill("NewPass123");
		await page.getByLabel("Xác nhận mật khẩu").fill("NewPass123");

		await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

		await expect(
			page.getByText(/Không thể đặt lại mật khẩu|Đã xảy ra lỗi|Vui lòng thử lại/i)
		).toBeVisible();

		await expect(page).toHaveURL(/\/forgot-password$/);
	});
});

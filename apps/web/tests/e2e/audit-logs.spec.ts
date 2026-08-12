import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

function uniqueEmail(tag: string): string {
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `e2e-audit-${tag}-${Date.now()}-${randomPart}@example.com`;
}

function uniqueLocalPhone(): string {
	const timestampPart = Date.now().toString().slice(-3);
	const randomPart = Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0");
	return `09${timestampPart}${randomPart}`;
}

interface E2EAuditLog {
	actorId: string | null;
	action: string;
	targetType: string;
	targetId: string;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
	reason: string | null;
	createdAt: string;
}

interface E2EUser {
	id: string;
	email: string;
	phone: string;
	status: string;
	role: string;
}

interface DbHelperUserResult {
	user: E2EUser | null;
	hasOtp: boolean;
}

interface DbHelperOtpResult {
	otp: string;
}

interface DbHelperLogsResult {
	logs: E2EAuditLog[];
}

function runDbHelper(action: string, arg: string): Record<string, unknown> {
	const cmd = `pnpm --filter @ctms/api exec ts-node src/seeds/db-helper.ts ${action} ${arg}`;
	const stdout = execSync(cmd, { cwd: WORKSPACE_ROOT }).toString();
	return JSON.parse(stdout) as Record<string, unknown>;
}

test.describe("Record Audit Logs for Critical Actions (E2E, real backend)", () => {
	test.describe.configure({ mode: "serial" });

	const email = uniqueEmail("tc");
	const phone = uniqueLocalPhone();
	const password = "S3curePass!";

	test.afterAll(() => {
		try {
			runDbHelper("clean-user", email);
		} catch (e) {
			console.error("Cleanup failed:", e);
		}
	});

	test("performs register -> verify otp -> login and asserts audit logs in DB", async ({
		page,
	}) => {
		// Intercept SMS/Email delivery requests on the frontend to prevent failing
		// due to unconfigured/mock external services (Twilio, SMTP).
		// We will generate the actual database OTP record via runDbHelper below.
		await page.route("**/api/auth/send-otp", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ id: "mock-otp-id", status: "pending_verification" }),
			});
		});

		// 1. Register Camper via UI
		await page.goto("/register");
		await page.getByRole("button", { name: "Tiếp tục nhập thông tin" }).click();
		await page.getByPlaceholder("Nguyễn Văn A").fill("Audit E2E User");
		const passwordInputs = page.getByPlaceholder("••••••••");
		await passwordInputs.nth(0).fill(password);
		await passwordInputs.nth(1).fill(password);
		await page.getByPlaceholder("camper@example.com").fill(email);
		await page.getByPlaceholder("0912345678").fill(phone);
		await page.getByRole("button", { name: "Đăng ký ngay" }).click();

		// Verify navigates to verify-otp
		await expect(page).toHaveURL(/\/verify-otp$/);
		await expect(page.getByText("Xác minh tài khoản")).toBeVisible();

		// Verify user row is created on backend and audit log 'auth.register' is written
		const userResult = runDbHelper("get-user", email) as unknown as DbHelperUserResult;
		expect(userResult.user).toBeDefined();
		if (!userResult.user) throw new Error("User not found in DB");
		expect(userResult.user.status).toBe("pending_verification");
		const userId = userResult.user.id;

		const registerLogsResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
		const registerLog = registerLogsResult.logs.find((l) => l.action === "auth.register");
		expect(registerLog).toBeDefined();
		if (!registerLog) throw new Error("Register log not found");
		expect(registerLog.actorId).toBe(userId);
		expect(registerLog.targetType).toBe("user");
		expect(registerLog.targetId).toBe(userId);
		expect(registerLog.before).toBeNull();
		expect(registerLog.after).toEqual({ role: "camper" });

		// 2. Select Verification Channel & request OTP via UI
		await page.getByRole("button", { name: "Xác minh qua SĐT" }).click();
		await page.getByRole("button", { name: "Gửi mã OTP" }).click();

		// Fetch issued OTP code from DB
		const otpResult = runDbHelper("get-otp", email) as unknown as DbHelperOtpResult;
		const otpCode = otpResult.otp;
		expect(otpCode).toBeDefined();

		// Fill OTP and click verify
		await page.getByLabel("Mã OTP *").fill(otpCode);
		await page.getByRole("button", { name: "Xác minh", exact: true }).click();

		// Success screen
		await expect(page.getByText("Xác thực thành công!")).toBeVisible();
		await page.getByRole("button", { name: "Đến trang đăng nhập ngay" }).click();
		await expect(page).toHaveURL(/\/login$/);

		// Verify user status is now active and verification OTP row is deleted
		const postVerifyUser = runDbHelper("get-user", email) as unknown as DbHelperUserResult;
		expect(postVerifyUser.user).toBeDefined();
		if (!postVerifyUser.user) throw new Error("User not found after verification");
		expect(postVerifyUser.user.status).toBe("active");
		expect(postVerifyUser.hasOtp).toBe(false);

		// Verify audit log 'auth.verify_otp' is written
		const verifyLogsResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
		const verifyLog = verifyLogsResult.logs.find((l) => l.action === "auth.verify_otp");
		expect(verifyLog).toBeDefined();
		if (!verifyLog) throw new Error("Verify log not found");
		expect(verifyLog.actorId).toBe(userId);
		expect(verifyLog.targetType).toBe("user");
		expect(verifyLog.targetId).toBe(userId);
		expect(verifyLog.before).toEqual({ status: "pending_verification" });
		expect(verifyLog.after).toEqual({ status: "active" });

		// 3. Log in with active user credentials via UI
		await page.goto("/login");
		await page.locator('input[type="text"]').first().fill(email);
		await page.locator('input[type="password"]').first().fill(password);
		await page.locator('form button[type="submit"]').click();

		// Verify successful login
		await expect(page.getByText(/Đăng nhập thành công! Chào mừng/)).toBeVisible();

		// Verify audit log 'auth.login' is written
		const loginLogsResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
		const loginLog = loginLogsResult.logs.find((l) => l.action === "auth.login");
		expect(loginLog).toBeDefined();
		if (!loginLog) throw new Error("Login log not found");
		expect(loginLog.actorId).toBe(userId);
		expect(loginLog.targetType).toBe("user");
		expect(loginLog.targetId).toBe(userId);
		expect(loginLog.before).toBeNull();
		expect(loginLog.after).toBeNull();
	});

	test("failed login attempt does not record audit logs and preserves DB state", async ({
		page,
	}) => {
		// Find logs before
		const userResult = runDbHelper("get-user", email) as unknown as DbHelperUserResult;
		expect(userResult.user).toBeDefined();
		if (!userResult.user) throw new Error("User not found");
		const userId = userResult.user.id;
		const logsBeforeResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
		const logsBefore = logsBeforeResult.logs;

		// Try to login with wrong password
		await page.goto("/login");
		await page.locator('input[type="text"]').first().fill(email);
		await page.locator('input[type="password"]').first().fill("WrongPassword1");
		await page.locator('form button[type="submit"]').click();

		// Verify rejection
		await expect(page.getByRole("alert")).toContainText(/không chính xác/i);

		// Verify no new audit logs are written for failed attempt
		const logsAfterResult = runDbHelper("get-logs", userId) as unknown as DbHelperLogsResult;
		const logsAfter = logsAfterResult.logs;
		expect(logsAfter.length).toBe(logsBefore.length);
	});
});

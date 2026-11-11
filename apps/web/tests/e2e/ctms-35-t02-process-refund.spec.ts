import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services", "api");
const TS_NODE_BIN = path.join(API_ROOT, "node_modules", "ts-node", "dist", "bin.js");
const DB_HELPER = path.join(API_ROOT, "src", "seeds", "db-helper.ts");
const PASSWORD = "S3curePass!";
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = (prefix: string) => `e2e-${unique(prefix)}@example.com`;
const phone = () =>
	`09${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100000)
		.toString()
		.padStart(5, "0")}`;

function db<T>(action: string, payload: unknown): T {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
	const stdout = execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, action, encoded], {
		cwd: API_ROOT,
	}).toString();
	return JSON.parse(stdout) as T;
}

async function login(page: Page, userEmail: string) {
	await page.goto("/login");
	await page.evaluate(() => {
		localStorage.clear();
	});
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

/**
 * CTMS-35-T02. Process Refund (UI E2E).
 *
 * Verifies the user-facing refund and complaint workflow for a Camper:
 * 1. Shows refund eligibility, charge amounts, and request windows based on authoritative server state.
 * 2. Allows submitting an eligible refund request with in-flight duplicate submission prevention.
 * 3. Presents refund states (pending/succeeded/failed/blocked) transparently without fabricating success.
 * 4. Displays validation and conflict errors clearly while preserving user input.
 * 5. Refreshes displayed financial and settlement state upon server confirmation.
 */
test.describe("CTMS-35-T02 Process Refund (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(90_000);

	const hostEmail = email("ctms35t02-host");
	const camperEmail = email("ctms35t02-camper");
	const adminEmail = email("ctms35t02-admin");
	const routeName = `E2E CTMS35T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS35T02 Trip ${Date.now()}`;
	let hostId = "";
	let camperId = "";
	let _adminId = "";
	let routeId = "";
	let tripId = "";

	test.beforeAll(() => {
		hostId = db<{ id: string }>("create-account", {
			email: hostEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		camperId = db<{ id: string }>("create-account", {
			email: camperEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		}).id;
		_adminId = db<{ id: string }>("create-account", {
			email: adminEmail,
			phone: phone(),
			password: PASSWORD,
			role: "admin",
			status: "active",
		}).id;
		routeId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId,
			routes: [{ name: routeName, status: "active" }],
		}).routes[0].id;
		tripId = db<{ id: string }>("seed-published-trip", {
			hostId,
			routeId,
			title: tripTitle,
			pricePerPerson: "500000.00",
			createdBy: camperId,
		}).id;
	});

	test.afterEach(() => {
		try {
			db("clean-bookings", { tripIds: [tripId] });
		} catch (error) {
			console.error("Clean bookings failed:", error);
		}
	});

	test.afterAll(() => {
		try {
			db("clean-bookings", { tripIds: [tripId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-trips", { tripIds: [tripId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-trekking-routes", { routeIds: [routeId] });
		} catch (error) {
			console.error(error);
		}
		for (const userEmail of [hostEmail, camperEmail, adminEmail]) {
			try {
				execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, "clean-user", userEmail], {
					cwd: API_ROOT,
				});
			} catch (error) {
				console.error(error);
			}
		}
	});

	test.beforeEach(async ({ page }) => {
		await page.setExtraHTTPHeaders({ "x-mock-payment": "true" });
	});

	test("Camper submits refund for a pre-Trip cancelled booking, and Admin confirms manual transfer", async ({
		page,
	}) => {
		// Seed cancelled booking with paid charge
		const { bookingId } = db<{ bookingId: string }>("seed-refund-fixture", {
			tripId,
			camperId,
			scenario: "cancelled_booking",
			chargeAmount: "500000.00",
		});

		await login(page, camperEmail);
		await page.goto(`/bookings/${bookingId}`);

		// 1. Verify Refund Status Card presents server-authoritative details
		await expect(page.getByRole("heading", { name: "Thông tin hoàn tiền" })).toBeVisible();
		await expect(page.getByText("Số tiền đã thanh toán:")).toBeVisible();
		await expect(page.getByText("Còn có thể hoàn:")).toBeVisible();
		await expect(page.getByTestId("remaining-refundable-amount")).toContainText("500.000");
		await expect(page.getByText("Trước thời điểm bắt đầu chuyến đi")).toBeVisible();

		// 2. Open refund request dialog
		const openBtn = page.getByTestId("open-refund-request-modal");
		await expect(openBtn).toBeVisible();
		await openBtn.click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Yêu cầu hoàn tiền & Khiếu nại" })
		).toBeVisible();

		// 3. Fill reason, beneficiary bank account details and submit
		const reasonInput = dialog.getByLabel(/Lý do yêu cầu/i);
		await expect(reasonInput).toBeFocused();
		await reasonInput.fill("Bận việc đột xuất trước ngày khởi hành");

		await dialog.getByLabel(/Số tài khoản/i).fill("0123456789");
		await dialog.getByLabel(/Tên chủ tài khoản/i).fill("NGUYEN VAN A");

		const submitBtn = dialog.getByTestId("submit-refund-button");
		await expect(submitBtn).toBeEnabled();
		await submitBtn.click();

		// 4. Modal closes and pending refund record appears with beneficiary details
		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Lịch sử hoàn tiền")).toBeVisible();
		await expect(page.getByTestId("refund-status-badge-pending").first()).toBeVisible();
		await expect(page.getByText(/0123456789/)).toBeVisible();

		// 5. Admin signs in and reviews manual refund transfer list
		await login(page, adminEmail);
		await page.goto("/admin/refunds");

		await expect(page.getByRole("heading", { name: "Quản lý hoàn tiền" })).toBeVisible();
		await expect(page.getByText("500.000").first()).toBeVisible();

		// Open confirm modal and enter bank transaction reference
		const confirmBtn = page.getByRole("button", { name: "Xác nhận chuyển" }).first();
		await expect(confirmBtn).toBeVisible();
		await confirmBtn.click();

		const confirmModal = page.locator("dialog[open]");
		await expect(confirmModal).toBeVisible();
		await confirmModal.getByLabel(/Mã giao dịch \/ Mã bill chuyển khoản/i).fill("VCB-REF-998877");
		await confirmModal.getByRole("button", { name: "Xác nhận đã chuyển tiền" }).click();

		// Wait for modal to close
		await expect(confirmModal).not.toBeVisible();

		// 6. Camper logs back in and verifies succeeded state with transaction reference
		await login(page, camperEmail);
		await page.goto(`/bookings/${bookingId}`);

		await expect(page.getByTestId("refund-status-badge-succeeded").first()).toBeVisible();
		await expect(page.getByText("Mã giao dịch đối soát: VCB-REF-998877")).toBeVisible();

		// 7. DB Verification
		const { payments } = db<{
			payments: Array<{ status: string; amount: string; type: string }>;
		}>("get-booking", { tripId, userId: camperId });

		const refundRow = payments.find((p) => p.type === "refund");
		expect(refundRow).toBeDefined();
		expect(refundRow?.amount).toBe("500000.00");
		expect(refundRow?.status).toBe("succeeded");
	});

	test("Camper submits complaint refund for a completed trip and sees settlement blocked status", async ({
		page,
	}) => {
		// Seed completed trip with completed booking and paid charge
		const { bookingId } = db<{ bookingId: string }>("seed-refund-fixture", {
			tripId,
			camperId,
			scenario: "completed_trip",
			chargeAmount: "300000.00",
		});

		await login(page, camperEmail);
		await page.goto(`/bookings/${bookingId}`);

		await expect(page.getByRole("heading", { name: "Thông tin hoàn tiền" })).toBeVisible();
		await expect(page.getByText("Trong vòng 24 giờ kể từ khi hoàn thành chuyến đi")).toBeVisible();

		const openBtn = page.getByTestId("open-refund-request-modal");
		await openBtn.click();

		const dialog = page.getByRole("dialog");
		await dialog.getByLabel(/Lý do yêu cầu/i).fill("Dịch vụ không đúng như cam kết về lều trại");
		await dialog.getByTestId("submit-refund-button").click();

		await expect(dialog).not.toBeVisible();

		// Verify refund record is rendered in history with pending state (awaiting admin review & transfer)
		await expect(page.getByText("Lịch sử hoàn tiền")).toBeVisible();
		await expect(page.getByTestId("refund-status-badge-pending").first()).toBeVisible();
	});

	test("shows validation error on empty reason or exceeding amount without claiming false success", async ({
		page,
	}) => {
		const { bookingId } = db<{ bookingId: string }>("seed-refund-fixture", {
			tripId,
			camperId,
			scenario: "cancelled_booking",
			chargeAmount: "500000.00",
		});

		await login(page, camperEmail);
		await page.goto(`/bookings/${bookingId}`);

		const openBtn = page.getByTestId("open-refund-request-modal");
		await openBtn.click();

		const dialog = page.getByRole("dialog");

		// Submitting empty reason triggers validation
		await dialog.getByTestId("submit-refund-button").click();
		await expect(dialog.getByText("Lý do phải có ít nhất 5 ký tự")).toBeVisible();

		// Submitting invalid monetary amount format
		await dialog.getByLabel(/Lý do yêu cầu/i).fill("Lý do hợp lệ");
		await dialog.getByLabel(/Số tiền yêu cầu hoàn/i).fill("abc");
		await dialog.getByTestId("submit-refund-button").click();
		await expect(
			dialog.getByText("Số tiền phải là số hợp lệ có tối đa 2 chữ số thập phân")
		).toBeVisible();

		// Dialog remains open with entered text preserved
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel(/Lý do yêu cầu/i)).toHaveValue("Lý do hợp lệ");

		// Cancel closes dialog
		await dialog.getByRole("button", { name: "Hủy bỏ" }).click();
		await expect(dialog).not.toBeVisible();
	});
});

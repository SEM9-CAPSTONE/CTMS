import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const API_ROOT = path.resolve(process.cwd(), "../../services/api");
const TS_NODE = path.join(API_ROOT, "node_modules/ts-node/dist/bin.js");
const DB_HELPER = path.join(API_ROOT, "src/seeds/db-helper.ts");
const API = process.env.CTMS_E2E_API_BASE_URL ?? "http://localhost:3000/api";
const PASSWORD = "S3curePass!";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const hostEmail = `e2e-ctms175-host-${suffix}@example.com`;
const ownerEmail = `e2e-ctms175-owner-${suffix}@example.com`;

function db<T>(action: string, payload: unknown): T {
	return JSON.parse(
		execFileSync(
			process.execPath,
			[TS_NODE, DB_HELPER, action, Buffer.from(JSON.stringify(payload)).toString("base64")],
			{ cwd: API_ROOT }
		).toString()
	) as T;
}
async function login(page: Page) {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(ownerEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

test.describe("CTMS-34-T02 Cancel Booking", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(120_000);
	let routeId = "";
	let validTripId = "";
	let conflictTripId = "";
	test.beforeAll(() => {
		const account = (email: string, role: string) =>
			db<{ id: string }>("create-account", {
				email,
				phone: `09${Math.floor(Math.random() * 100000000)
					.toString()
					.padStart(8, "0")}`,
				password: PASSWORD,
				role,
				status: "active",
			}).id;
		const hostId = account(hostEmail, "host");
		const ownerId = account(ownerEmail, "camper");
		routeId = db<{ routes: { id: string }[] }>("seed-trekking-routes", {
			hostId,
			routes: [{ name: `E2E CTMS175 ${suffix}`, status: "active" }],
		}).routes[0].id;
		const base = { hostId, routeId, createdBy: ownerId, pricePerPerson: "0.00" };
		// Synthetic policy only in the test fixture; Web never evaluates it.
		validTripId = db<{ id: string }>("seed-published-trip", {
			...base,
			title: `E2E CTMS175 valid ${suffix}`,
			cancellationPolicy: { version: 1, rules: [{ minHoursBeforeTrip: 0, refundPercent: 50 }] },
		}).id;
		conflictTripId = db<{ id: string }>("seed-published-trip", {
			...base,
			title: `E2E CTMS175 conflict ${suffix}`,
		}).id;
	});
	test.afterAll(() => {
		const tripIds = [validTripId, conflictTripId].filter(Boolean);
		for (const [action, input] of [
			["clean-bookings", { tripIds }],
			["clean-trips", { tripIds }],
			["clean-trekking-routes", { routeIds: [routeId].filter(Boolean) }],
		] as const)
			db(action, input);
		for (const email of [ownerEmail, hostEmail])
			execFileSync(process.execPath, [TS_NODE, DB_HELPER, "clean-user", email], { cwd: API_ROOT });
	});

	async function createAndOpen(page: Page, tripId: string) {
		await login(page);
		await page.goto(`/trips/${tripId}`);
		const created = page.waitForResponse(
			(response) => response.url() === `${API}/bookings` && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: /Đặt chỗ ngay/i }).click();
		const response = await created;
		expect(response.status(), await response.text()).toBe(201);
		const booking = (await response.json()) as { id: string };
		await page.getByRole("button", { name: "Xem chi tiết đặt chỗ", exact: true }).click();
		await expect(page.getByRole("button", { name: "Yêu cầu hủy đơn" })).toBeVisible();
		return booking.id;
	}

	test("confirms real cancellation once, handles modal focus, refreshes details/list and Trip return", async ({
		page,
	}) => {
		const bookingId = await createAndOpen(page, validTripId);
		const action = page.getByRole("button", { name: "Yêu cầu hủy đơn" });
		await action.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("textbox")).toBeFocused();
		await dialog.getByRole("textbox").fill("  Changed plans  ");
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();
		await expect(action).toBeFocused();
		await action.click();
		await expect(dialog.getByRole("textbox")).toHaveValue("  Changed plans  ");
		await expect(dialog.getByText(/Chưa có báo giá hoàn tiền/)).toBeVisible();
		await expect(dialog.getByTestId("cancellation-refund-amount")).toHaveCount(0);

		let patchCount = 0;
		let release!: () => void;
		const holdResponse = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(`**/api/bookings/${bookingId}/cancel`, async (route) => {
			patchCount += 1;
			expect(route.request().method()).toBe("PATCH");
			expect(route.request().postDataJSON()).toEqual({ reason: "Changed plans" });
			expect(route.request().headers()["idempotency-key"]).toBeUndefined();
			const response = await route.fetch();
			expect(response.status()).toBe(200);
			await holdResponse;
			await route.fulfill({ response });
		});
		const confirm = dialog.getByRole("button", { name: "Xác nhận hủy", exact: true });
		await confirm.click();
		await expect(dialog.getByRole("button", { name: "Đang gửi yêu cầu..." })).toBeDisabled();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeVisible();
		await dialog
			.getByRole("button", { name: "Đang gửi yêu cầu..." })
			.evaluate((button: HTMLButtonElement) => button.click());
		await expect.poll(() => patchCount).toBe(1);
		release();
		await expect(page.getByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })).toBeVisible();
		await expect(page.getByText("Trạng thái: Đã hủy")).toBeVisible();
		await expect(page.getByTestId("cancellation-refund-amount")).toHaveCount(0);
		await expect(page.getByText("Đang tải lại chi tiết đơn...")).not.toBeVisible();
		await page.getByRole("button", { name: "Quay lại chi tiết chuyến đi" }).click();
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("10 chỗ");
		await expect(page.getByRole("status").filter({ hasText: "cancelled" })).toBeVisible();
		await page.reload();
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("10 chỗ");
		await expect(page.getByRole("status").filter({ hasText: "cancelled" })).toBeVisible();
		await expect(page.getByRole("button", { name: /Đặt chỗ ngay/i })).toHaveCount(0);
		await page.goto(`/bookings/${bookingId}`);
		await expect(page.getByText("Trạng thái: Đã hủy")).toBeVisible();
		await page.reload();
		await expect(page.getByText(/Thông tin hoàn tiền không có/)).toBeVisible();
		await expect(page.getByRole("button", { name: "Yêu cầu hủy đơn" })).toHaveCount(0);
		await page.getByRole("button", { name: "Quay lại đơn đặt chỗ" }).click();
		await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
		expect(patchCount).toBe(1);
	});

	test("shows authoritative policy conflict, retains reason and permits reload without claiming success", async ({
		page,
	}) => {
		const bookingId = await createAndOpen(page, conflictTripId);
		await page.getByRole("button", { name: "Yêu cầu hủy đơn" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByRole("textbox").fill("Please keep this reason");
		const rejected = page.waitForResponse(
			(response) => response.url() === `${API}/bookings/${bookingId}/cancel`
		);
		await dialog.getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
		expect((await rejected).status()).toBe(409);
		await expect(dialog.getByRole("alert")).toContainText("Máy chủ chưa chấp nhận hủy");
		await dialog.getByRole("button", { name: "Tải lại thông tin" }).click();
		await expect(dialog.getByRole("button", { name: "Xác nhận hủy", exact: true })).toBeEnabled();
		await expect(dialog.getByRole("textbox")).toHaveValue("Please keep this reason");
		await expect(page.getByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })).toHaveCount(0);
		await dialog.getByRole("button", { name: "Giữ đơn đặt chỗ" }).click();
		await page.reload();
		await expect(page.getByText("Trạng thái: Đã xác nhận")).toBeVisible();
	});
});

import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const API_ROOT = path.resolve(process.cwd(), "../../services/api");
const TS_NODE = path.join(API_ROOT, "node_modules/ts-node/dist/bin.js");
const DB_HELPER = path.join(API_ROOT, "src/seeds/db-helper.ts");
const API = process.env.CTMS_E2E_API_BASE_URL ?? "http://localhost:3000/api";
const PASSWORD = "S3curePass!";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const hostEmail = `e2e-ctms173-host-${suffix}@example.com`;
const camperEmail = `e2e-ctms173-camper-${suffix}@example.com`;

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
	await page.locator('input[type="text"]').first().fill(camperEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

test.describe("CTMS-33-T02 Automatically Expire Booking UI", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(120_000);
	let routeId = "";
	let tripId = "";
	let camperId = "";

	test.beforeAll(() => {
		const createAccount = (email: string, role: string) =>
			db<{ id: string }>("create-account", {
				email,
				phone: `09${Math.floor(Math.random() * 100000000)
					.toString()
					.padStart(8, "0")}`,
				password: PASSWORD,
				role,
				status: "active",
			}).id;
		const hostId = createAccount(hostEmail, "host");
		camperId = createAccount(camperEmail, "camper");
		routeId = db<{ routes: { id: string }[] }>("seed-trekking-routes", {
			hostId,
			routes: [{ name: `E2E CTMS173 ${suffix}`, status: "active" }],
		}).routes[0].id;
		tripId = db<{ id: string }>("seed-published-trip", {
			hostId,
			routeId,
			createdBy: camperId,
			title: `E2E CTMS173 expiry ${suffix}`,
			pricePerPerson: "100000.00",
		}).id;
	});

	test.afterAll(() => {
		const tripIds = [tripId].filter(Boolean);
		for (const [action, input] of [
			["clean-bookings", { tripIds }],
			["clean-trips", { tripIds }],
			["clean-trekking-routes", { routeIds: [routeId].filter(Boolean) }],
		] as const) {
			db(action, input);
		}
		for (const email of [camperEmail, hostEmail]) {
			execFileSync(process.execPath, [TS_NODE, DB_HELPER, "clean-user", email], { cwd: API_ROOT });
		}
	});

	test("shows backend expiry across List, Details and restored Trip state", async ({ page }) => {
		await login(page);
		await page.goto(`/trips/${tripId}`);
		const created = page.waitForResponse(
			(response) => response.url() === `${API}/bookings` && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: /Đặt chỗ ngay/i }).click();
		const createResponse = await created;
		expect(createResponse.status(), await createResponse.text()).toBe(201);
		const booking = (await createResponse.json()) as { id: string };
		db("set-booking-hold-overdue", { bookingId: booking.id });
		const expiry = db<{ result: string }>("expire-booking-through-service", {
			bookingId: booking.id,
		});
		expect(expiry.result).toBe("expired");

		const token = await page.evaluate(() => localStorage.getItem("accessToken"));
		await expect
			.poll(
				async () => {
					const response = await page.request.get(`${API}/bookings/${booking.id}`, {
						headers: { Authorization: `Bearer ${token}` },
					});
					if (!response.ok()) return `http-${response.status()}`;
					return ((await response.json()) as { status: string }).status;
				},
				{ timeout: 15_000, intervals: [250] }
			)
			.toBe("expired");

		await page.goto("/bookings");
		const listCard = page.getByRole("article").filter({ hasText: booking.id });
		await expect(listCard.getByText("Đã hết hạn", { exact: true })).toBeVisible();
		await expect(listCard.getByTestId(`booking-status-${booking.id}`)).toHaveClass(/bg-rose-100/);
		await listCard.getByRole("button", { name: "Xem chi tiết" }).click();

		await expect(page.getByText("Trạng thái: Đã hết hạn")).toBeVisible();
		await expect(page.getByRole("button", { name: "Thanh toán ngay" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Yêu cầu hủy đơn" })).toHaveCount(0);

		await page.goto(`/trips/${tripId}`);
		const expiredPanel = page.locator('[data-booking-state="expired"]');
		await expect(expiredPanel).toContainText("Đơn đặt chỗ đã hết hạn");
		await expect(expiredPanel).not.toContainText("Đã tạo đặt chỗ thành công");
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("10 chỗ");
		await expect(page.getByRole("button", { name: "Thanh toán ngay" })).toHaveCount(0);

		await page.reload();
		await expect(page.locator('[data-booking-state="expired"]')).toContainText(
			"Đơn đặt chỗ đã hết hạn"
		);
		await expect(page.getByTestId("trip-remaining-seats")).toHaveText("10 chỗ");

		const stored = db<{ booking: { status: string; paymentStatus: string } }>("get-booking", {
			tripId,
			userId: camperId,
		});
		expect(stored.booking).toMatchObject({ status: "expired", paymentStatus: "unpaid" });
	});
});

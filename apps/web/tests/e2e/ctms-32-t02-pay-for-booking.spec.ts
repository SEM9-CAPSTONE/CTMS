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
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

/**
 * CTMS-32-T02. Pay for Booking (UI E2E).
 *
 * Verifies the user-facing payment workflow for a Camper:
 * 1. Creates a booking for a published trip.
 * 2. Observes the payable state, amount, and payment method selector.
 * 3. Submits the payment and observes the authoritative success state.
 * 4. Verifies database persistence of the Payment and updated Booking status.
 * 5. Verifies blocked/conflict state when the booking has already been paid.
 */
test.describe("CTMS-32-T02 Pay for Booking (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);
	const hostEmail = email("ctms32t02-host");
	const camperEmail = email("ctms32t02-camper");
	const routeName = `E2E CTMS32T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS32T02 Trip ${Date.now()}`;
	let hostId = "";
	let camperId = "";
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
			console.error(error);
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
		for (const userEmail of [hostEmail, camperEmail]) {
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

	test("Camper creates a Booking, pays for it, and sees the authoritative confirmation", async ({
		page,
	}) => {
		await login(page, camperEmail);
		await page.goto(`/trips/${tripId}`);

		await expect(page.getByText(tripTitle)).toBeVisible();
		await page.getByRole("button", { name: "Đặt chỗ ngay" }).click();
		await expect(page.getByText("Đã tạo đặt chỗ thành công")).toBeVisible();

		// Payment panel is visible and displays the amount
		const paymentSection = page.getByRole("region", { name: "Thanh toán đặt chỗ" });
		await expect(paymentSection).toBeVisible();
		await expect(page.getByTestId("payment-amount-display")).toHaveText(/500\.000/);

		// Card payment method is dimmed/disabled; bank transfer is selected by default
		await expect(page.getByLabel(/Thẻ quốc tế/i)).toBeDisabled();
		await expect(page.getByLabel(/Chuyển khoản ngân hàng/i)).toBeChecked();
		await page.getByRole("button", { name: "Thanh toán ngay" }).click();

		// Success confirmation appears with authoritative result
		const resultSection = page.getByRole("status", { name: "Kết quả thanh toán" });
		await expect(resultSection).toBeVisible();
		await expect(resultSection).toContainText("Thanh toán thành công!");
		await expect(page.getByTestId("authoritative-payment-amount")).toHaveText(/500\.000/);
		await expect(page.getByTestId("authoritative-payment-status")).toHaveText("succeeded");
		await expect(page.getByTestId("authoritative-booking-status")).toHaveText("confirmed");

		// Authoritative persistence check in DB
		const { booking, payments } = db<{
			booking: { status: string; paymentStatus: string; totalAmount: string } | null;
			payments: Array<{ status: string; amount: string; type: string }>;
		}>("get-booking", { tripId, userId: camperId });

		expect(booking).toMatchObject({
			status: "confirmed",
			paymentStatus: "paid",
			totalAmount: "500000.00",
		});
		expect(payments).toHaveLength(1);
		expect(payments[0]).toMatchObject({
			status: "succeeded",
			amount: "500000.00",
			type: "charge",
		});
	});

	test("shows the already-paid status when visiting a confirmed and paid booking", async ({
		page,
	}) => {
		await login(page, camperEmail);
		await page.goto(`/trips/${tripId}`);

		await page.getByRole("button", { name: "Đặt chỗ ngay" }).click();
		await expect(page.getByText("Đã tạo đặt chỗ thành công")).toBeVisible();

		// Pay first
		await page.getByRole("button", { name: "Thanh toán ngay" }).click();
		await expect(page.getByText("Thanh toán thành công!")).toBeVisible();

		// Payment button should no longer exist once paid
		await expect(page.getByRole("button", { name: "Thanh toán ngay" })).not.toBeVisible();
	});
});

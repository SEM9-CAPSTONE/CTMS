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
 * CTMS-40-T02. Real backend/Postgres/Chrome, no mocking (mirrors
 * ctms-23-t02-approve-publish-trip.spec.ts's own db-helper convention).
 * Seeds a published Trip with a real green Weather Risk assessment and an
 * active equipment_catalog_item directly (both are CTMS-024/CTMS-029/
 * CTMS-039's own already-tested preconditions, not this story's concern),
 * then drives the real "Đặt chỗ" -> "Thêm thiết bị" flow through the UI.
 */
test.describe("CTMS-40-T02 Add Services and Equipment Rental to Booking (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);
	const hostEmail = email("ctms40t02-host");
	const camperEmail = email("ctms40t02-camper");
	const routeName = `E2E CTMS40T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS40T02 Trip ${Date.now()}`;
	const equipmentName = `E2E CTMS40T02 Tent ${Date.now()}`;
	let hostId = "";
	let camperId = "";
	let routeId = "";
	let tripId = "";
	let equipmentId = "";

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
		equipmentId = db<{ id: string }>("seed-equipment", {
			hostId,
			name: equipmentName,
			rentalPricePerDay: "50000.00",
		}).id;
	});

	test.afterAll(() => {
		try {
			db("clean-bookings", { tripIds: [tripId] });
		} catch (error) {
			console.error(error);
		}
		try {
			db("clean-equipment", { equipmentIds: [equipmentId] });
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

	test("Camper books the Trip, adds an equipment item, and sees the authoritative total", async ({
		page,
	}) => {
		await login(page, camperEmail);
		await page.goto(`/trips/${tripId}`);

		await expect(page.getByText(tripTitle)).toBeVisible();
		await page.getByRole("button", { name: /đặt chỗ ngay/i }).click();
		await expect(page.getByRole("heading", { name: "Đã tạo đặt chỗ thành công" })).toBeVisible();

		await expect(page.getByLabel("Thiết bị", { exact: true })).toBeVisible();
		await page.getByLabel("Thiết bị", { exact: true }).selectOption(equipmentId);
		await page.getByLabel("Số lượng thiết bị").fill("2");
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();

		await expect(page.getByText(new RegExp(`${equipmentName} x2`))).toBeVisible();
		const totalAmount = page.getByTestId("booking-total-amount");
		await expect(totalAmount).toHaveText(/600\.000/);

		const { booking, items } = db<{
			booking: { totalAmount: string; basePrice: string } | null;
			items: Array<{ quantity: number; totalPrice: string }>;
		}>("get-booking", { tripId, userId: camperId });

		expect(booking).toMatchObject({ basePrice: "500000.00", totalAmount: "600000.00" });
		expect(items).toEqual([expect.objectContaining({ quantity: 2, totalPrice: "100000.00" })]);
	});

	test("rejects a quantity that exceeds availability without a false-success state", async ({
		page,
	}) => {
		await login(page, camperEmail);
		await page.goto(`/trips/${tripId}`);

		await page.getByRole("button", { name: /đặt chỗ ngay/i }).click();
		await expect(page.getByRole("heading", { name: "Đã tạo đặt chỗ thành công" })).toBeVisible();

		await page.getByLabel("Thiết bị", { exact: true }).selectOption(equipmentId);
		await page.getByLabel("Số lượng thiết bị").fill("999");
		await page.getByRole("button", { name: "Thêm thiết bị" }).click();

		await expect(page.getByRole("alert")).toBeVisible();
	});
});

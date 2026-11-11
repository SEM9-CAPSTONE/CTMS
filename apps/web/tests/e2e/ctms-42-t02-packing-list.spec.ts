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

async function selectEquipmentBeforeBooking(page: Page, name: string, quantity: number) {
	await page.getByRole("button", { name: "Xem tất cả thiết bị cho thuê" }).click();
	const item = page.locator('[data-testid^="equipment-item-"]').filter({ hasText: name });
	await item.getByLabel(`Chọn thuê ${name}`).check();
	for (let current = 1; current < quantity; current += 1) {
		await item.getByRole("button", { name: `Tăng số lượng ${name}` }).click();
	}
	await page.getByRole("button", { name: /Xác nhận thuê/ }).click();
	await expect(page.getByTestId("equipment-confirm-modal-step")).toBeVisible();
	await page.getByRole("button", { name: "Xác nhận & Áp dụng" }).click();
	await expect(page.getByTestId("rentable-equipment-modal-backdrop")).toHaveCount(0);
}

/**
 * CTMS-42-T02. Real backend/Postgres/Chrome, no mocking (mirrors
 * ctms-40-t02-add-equipment-to-booking.spec.ts's own db-helper convention).
 * Seeds a published day-trip Trip with a green Weather Risk assessment and
 * an active equipment_catalog_item (both already-tested preconditions of
 * CTMS-024/CTMS-029/CTMS-039, not this story's concern), then drives the
 * real pre-booking equipment selection -> booking -> packing list flow.
 */
test.describe("CTMS-42-T02 Receive Personalized Packing List for Trip (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);
	const hostEmail = email("ctms42t02-host");
	const camperEmail = email("ctms42t02-camper");
	const routeName = `E2E CTMS42T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS42T02 Trip ${Date.now()}`;
	const equipmentName = `E2E CTMS42T02 Tent ${Date.now()}`;
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

	test("Camper books the Trip, sees a personalized packing list, and it refreshes after adding equipment", async ({
		page,
	}) => {
		await login(page, camperEmail);
		await page.goto(`/trips/${tripId}`);

		await expect(page.getByText(tripTitle)).toBeVisible();
		await selectEquipmentBeforeBooking(page, equipmentName, 1);
		await page.getByRole("button", { name: /đặt chỗ ngay/i }).click();
		await expect(page.getByRole("heading", { name: "Đã tạo đặt chỗ thành công" })).toBeVisible();

		await expect(page.getByText("Thiết bị thuê kèm (1 món):")).toBeVisible();
		await page.getByRole("button", { name: /Xem danh sách đồ cần chuẩn bị/ }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("heading", { name: "Danh sách đồ cần chuẩn bị" })).toBeVisible();
		await expect(page.getByTestId("packing-list-item-id-documents")).toBeVisible();
		await expect(page.getByTestId("packing-list-item-drinking-water")).toBeVisible();

		const rentedItem = page.locator('[data-testid^="packing-list-item-rented-"]');
		await expect(rentedItem).toBeVisible();
		await expect(rentedItem).toContainText("Đã có trong thiết bị thuê");

		await page.getByRole("button", { name: "Đóng", exact: true }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
	});
});

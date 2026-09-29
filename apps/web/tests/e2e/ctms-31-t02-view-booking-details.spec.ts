import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");
const API_ROOT = path.join(WORKSPACE_ROOT, "services", "api");
const TS_NODE_BIN = path.join(API_ROOT, "node_modules", "ts-node", "dist", "bin.js");
const DB_HELPER = path.join(API_ROOT, "src", "seeds", "db-helper.ts");
const API_BASE_URL = process.env.CTMS_E2E_API_BASE_URL ?? "http://localhost:3000/api";
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

function cleanUser(userEmail: string): void {
	execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, "clean-user", userEmail], {
		cwd: API_ROOT,
	});
}

async function login(page: Page, userEmail: string): Promise<string> {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
	return (await page.evaluate(() => localStorage.getItem("accessToken"))) as string;
}

test.describe("CTMS-31-T02 View Booking Details", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(120_000);

	const hostEmail = email("ctms31t02-host");
	const ownerEmail = email("ctms31t02-owner");
	const participantEmail = email("ctms31t02-participant");
	const otherCamperEmail = email("ctms31t02-other");
	const routeName = `E2E CTMS31T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS31T02 Trip ${Date.now()}`;
	const equipmentName = `E2E CTMS31T02 Tent ${Date.now()}`;
	let ownerId = "";
	let participantId = "";
	let routeId = "";
	let tripId = "";
	let equipmentId = "";
	let bookingId = "";

	test.beforeAll(() => {
		const hostId = db<{ id: string }>("create-account", {
			email: hostEmail,
			phone: phone(),
			password: PASSWORD,
			role: "host",
			status: "active",
		}).id;
		ownerId = db<{ id: string }>("create-account", {
			email: ownerEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		}).id;
		participantId = db<{ id: string }>("create-account", {
			email: participantEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		}).id;
		db("create-account", {
			email: otherCamperEmail,
			phone: phone(),
			password: PASSWORD,
			role: "camper",
			status: "active",
		});
		routeId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId,
			routes: [{ name: routeName, status: "active" }],
		}).routes[0].id;
		tripId = db<{ id: string }>("seed-published-trip", {
			hostId,
			routeId,
			title: tripTitle,
			pricePerPerson: "500000.00",
			createdBy: ownerId,
		}).id;
		equipmentId = db<{ id: string }>("seed-equipment", {
			hostId,
			name: equipmentName,
			rentalPricePerDay: "50000.00",
		}).id;
	});

	test.afterAll(() => {
		for (const [action, payload] of [
			["clean-bookings", { tripIds: [tripId] }],
			["clean-equipment", { equipmentIds: [equipmentId] }],
			["clean-trips", { tripIds: [tripId] }],
			["clean-trekking-routes", { routeIds: [routeId] }],
		] as const) {
			try {
				db(action, payload);
			} catch (error) {
				console.error(error);
			}
		}
		for (const userEmail of [hostEmail, ownerEmail, participantEmail, otherCamperEmail]) {
			try {
				cleanUser(userEmail);
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("owner returns later through the sidebar list, reopens details, and refreshes", async ({
		page,
	}) => {
		const accessToken = await login(page, ownerEmail);
		const headers = { Authorization: `Bearer ${accessToken}` };
		let createRequestCount = 0;
		page.on("request", (request) => {
			if (request.method() === "POST" && request.url() === `${API_BASE_URL}/bookings`) {
				createRequestCount += 1;
			}
		});
		await page.goto(`/trips/${tripId}`);
		await page.getByRole("button", { name: "Tăng số lượng khách" }).click();
		const createResponsePromise = page.waitForResponse(
			(response) =>
				response.url() === `${API_BASE_URL}/bookings` && response.request().method() === "POST"
		);
		await page.getByRole("button", { name: "Đặt chỗ ngay" }).click();
		const createResponse = await createResponsePromise;
		expect(createResponse.status()).toBe(201);
		const created = (await createResponse.json()) as { id: string };
		bookingId = created.id;

		await page.getByRole("button", { name: "Xem chi tiết đặt chỗ" }).click();
		await expect(page).toHaveURL(
			new RegExp(`/bookings/${bookingId}\\?from=trip&tripId=${tripId}$`)
		);
		await page.getByRole("button", { name: "Quay lại chi tiết chuyến đi" }).click();
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}$`));
		await expect(page.getByText(bookingId, { exact: false })).toBeVisible();
		expect(createRequestCount).toBe(1);

		const membersResponse = await page.request.post(
			`${API_BASE_URL}/bookings/${bookingId}/members`,
			{
				headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
				data: { members: [{ userId: participantId }] },
			}
		);
		expect(membersResponse.status()).toBe(201);

		await page.goto(`/bookings/${bookingId}?from=trip&tripId=${tripId}`);
		await expect(page.getByRole("heading", { name: "Chi tiết đơn đặt chỗ" })).toBeVisible();
		await page.getByRole("button", { name: "Quay lại chi tiết chuyến đi" }).click();
		await expect(page).toHaveURL(new RegExp(`/trips/${tripId}$`));
		await expect(page.getByText("Danh sách người tham gia đã được xác nhận")).toBeVisible();
		await expect(page.getByText(participantEmail)).toBeVisible();
		expect(createRequestCount).toBe(1);

		const itemResponse = await page.request.post(`${API_BASE_URL}/bookings/${bookingId}/items`, {
			headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
			data: { equipmentCatalogItemId: equipmentId, quantity: 2 },
		});
		expect(itemResponse.status()).toBe(201);
		const itemResult = (await itemResponse.json()) as { booking: { totalAmount: string } };
		const detailResponse = await page.request.get(`${API_BASE_URL}/bookings/${bookingId}`, {
			headers,
		});
		expect(detailResponse.status(), await detailResponse.text()).toBe(200);
		const displayedTotal = new Intl.NumberFormat("vi-VN", {
			style: "currency",
			currency: "VND",
			maximumFractionDigits: 0,
		}).format(Number(itemResult.booking.totalAmount));

		await page.goto(`/bookings/${bookingId}`);
		await expect(page.getByRole("heading", { name: "Chi tiết đơn đặt chỗ" })).toBeVisible();
		await expect(page.getByText(bookingId, { exact: false })).toBeVisible();
		await expect(page.getByText("Chờ thanh toán", { exact: false })).toBeVisible();
		await expect(page.getByText("Chưa thanh toán", { exact: false }).first()).toBeVisible();
		await expect(page.getByText(tripTitle)).toBeVisible();
		await expect(page.getByText(routeName)).toBeVisible();
		await expect(page.getByText(participantEmail)).toBeVisible();
		await expect(page.getByText("Người đặt chỗ chính")).toBeVisible();
		await expect(page.getByText(equipmentName)).toBeVisible();
		await expect(page.getByTestId("authoritative-total-amount")).toHaveText(displayedTotal);
		await expect(page.getByText("Bắt đầu theo lịch đã đặt")).toBeVisible();

		await page.goto("/dashboard");
		await page.getByRole("button", { name: "Đơn đặt chỗ", exact: true }).click();
		await expect(page).toHaveURL(/\/bookings$/);
		await expect(page.getByRole("heading", { name: "Đơn đặt chỗ của bạn" })).toBeVisible();
		await expect(page.getByText(tripTitle)).toBeVisible();
		await expect(page.getByText(bookingId, { exact: false })).toBeVisible();
		await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}\\?from=bookings$`));
		await expect(page.getByText(participantEmail)).toBeVisible();
		await expect(page.getByText(equipmentName)).toBeVisible();
		await page.getByRole("button", { name: "Quay lại đơn đặt chỗ" }).click();
		await expect(page).toHaveURL(/\/bookings$/);
		await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();

		await page.reload();
		await expect(page.getByText(participantEmail)).toBeVisible();
		await expect(page.getByText(equipmentName)).toBeVisible();
		await expect(page.getByTestId("authoritative-total-amount")).toHaveText(displayedTotal);
	});

	test("a Camper without owned Bookings sees the empty list and no foreign Booking", async ({
		page,
	}) => {
		await login(page, otherCamperEmail);
		await page.goto("/bookings");
		await expect(page.getByText("Bạn chưa có đơn đặt chỗ nào.")).toBeVisible();
		await expect(page.getByText(bookingId, { exact: false })).toHaveCount(0);
	});

	test("another Camper receives the dedicated forbidden state without nested details", async ({
		page,
	}) => {
		await login(page, otherCamperEmail);
		await page.goto(`/bookings/${bookingId}`);
		await expect(page.getByRole("heading", { name: "Không thể xem đơn đặt chỗ" })).toBeVisible();
		await expect(page.getByText("Bạn không có quyền xem đơn đặt chỗ này.")).toBeVisible();
		await expect(page.getByText(participantEmail)).toHaveCount(0);
		await expect(page.getByText(equipmentName)).toHaveCount(0);
	});
});

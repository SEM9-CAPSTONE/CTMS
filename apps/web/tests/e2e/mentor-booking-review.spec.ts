import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const API_ROOT = path.resolve(process.cwd(), "../../services/api");
const API = "http://127.0.0.1:3012/api";
const password = "MentorE2ePass!42";
const suffix = randomUUID();
const emails = {
	host: `e2e-mentor-host-${suffix}@example.com`,
	camper: `e2e-mentor-camper-${suffix}@example.com`,
	admin: `e2e-mentor-admin-${suffix}@example.com`,
	porter: `e2e-mentor-porter-${suffix}@example.com`,
};
const tripIds: string[] = [];
let routeId = "";
let freeTripId = "";
let paidTripId = "";
let accountIds: Record<string, string> = {};

function db<T>(action: string, payload: unknown): T {
	return JSON.parse(
		execFileSync(
			process.execPath,
			[
				path.join(API_ROOT, "node_modules/ts-node/dist/bin.js"),
				"--transpile-only",
				path.join(API_ROOT, "src/seeds/db-helper.ts"),
				action,
				Buffer.from(JSON.stringify(payload)).toString("base64"),
			],
			{ cwd: API_ROOT }
		).toString()
	) as T;
}
async function captureEvidence(page: Page, name: string) {
	const directory = process.env.CTMS_EVIDENCE_DIR;
	if (directory)
		await page.screenshot({
			path: path.join(directory, `${name}.png`),
			fullPage: true,
			animations: "disabled",
		});
}

async function login(page: Page, email: string) {
	await page.route("https://**/*", (route) => route.abort());
	await page.goto("/login", { waitUntil: "domcontentloaded" });
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
	return page.evaluate(() => localStorage.getItem("accessToken") ?? "");
}

test.beforeAll(() => {
	if (!new URL(process.env.DATABASE_URL ?? "").pathname.endsWith("_test"))
		throw new Error("Test database required");
	const ids = Object.fromEntries(
		Object.entries(emails).map(([role, email]) => [
			role,
			db<{ id: string }>("create-account", {
				email,
				phone: `09${Math.floor(Math.random() * 100000000)
					.toString()
					.padStart(8, "0")}`,
				password,
				role,
				status: "active",
			}).id,
		])
	);
	accountIds = ids;
	routeId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
		hostId: ids.host,
		routes: [{ name: `E2E mentor route ${suffix}`, status: "active" }],
	}).routes[0].id;
	for (const [price, label] of [
		["0.00", "free"],
		["500000.00", "paid"],
	]) {
		const tripId = db<{ id: string }>("seed-published-trip", {
			hostId: ids.host,
			routeId,
			createdBy: ids.camper,
			title: `E2E mentor ${label} ${suffix}`,
			pricePerPerson: price,
		}).id;
		tripIds.push(tripId);
		if (label === "free") freeTripId = tripId;
		else paidTripId = tripId;
	}
});
test.afterAll(() => {
	if (tripIds.length) {
		db("clean-bookings", { tripIds });
		db("clean-trips", { tripIds });
	}
	if (routeId) db("clean-trekking-routes", { routeIds: [routeId] });
	for (const email of Object.values(emails))
		execFileSync(
			process.execPath,
			[
				path.join(API_ROOT, "node_modules/ts-node/dist/bin.js"),
				"--transpile-only",
				path.join(API_ROOT, "src/seeds/db-helper.ts"),
				"clean-user",
				email,
			],
			{ cwd: API_ROOT }
		);
});

test("requires cancellation reason, notifies host/admin, persists read state and permits rebooking", async ({
	page,
	browser,
}) => {
	const token = await login(page, emails.camper);
	const response = await page.request.post(`${API}/bookings`, {
		headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": randomUUID() },
		data: { tripId: freeTripId, numPeople: 1 },
	});
	expect(response.status()).toBe(201);
	const booking = (await response.json()) as { id: string };
	await page.goto(`/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Yêu cầu hủy đơn" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
	await expect(dialog.getByText("Vui lòng nhập lý do hủy chuyến.")).toBeVisible();
	await captureEvidence(page, "18-real-api-cancel-reason-required");
	await dialog.getByRole("textbox").fill("Đổi lịch theo kế hoạch gia đình");
	await captureEvidence(page, "19-real-api-cancel-confirmation");
	await dialog.getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Đã xác nhận hủy đơn đặt chỗ" })).toBeVisible();
	await page.screenshot({ path: "test-results/mentor-cancellation.png", fullPage: true });
	await captureEvidence(page, "20-real-api-cancellation-success");
	await page.getByRole("link", { name: "Xem chuyến và đặt lại" }).click();

	await expect(page.getByRole("button", { name: /Đặt chỗ ngay/ })).toBeEnabled();
	await captureEvidence(page, "21-real-api-rebook-enabled");
	const rebookResponse = page.waitForResponse(
		(response) => response.url() === `${API}/bookings` && response.request().method() === "POST"
	);
	await page.getByRole("button", { name: /Đặt chỗ ngay/ }).click();
	expect((await rebookResponse).status()).toBe(201);

	for (const role of ["host", "admin"] as const) {
		const recipient = await browser.newPage({ baseURL: "http://127.0.0.1:5176" });
		try {
			await login(recipient, emails[role]);
			await recipient.goto(role === "host" ? "/dashboard" : "/admin/users", {
				waitUntil: "domcontentloaded",
			});
			await recipient.getByRole("button", { name: /Thông báo hủy đặt chỗ/ }).click();
			await expect(recipient.getByText("Lý do: Đổi lịch theo kế hoạch gia đình")).toBeVisible();
			await captureEvidence(recipient, `22-real-api-${role}-cancellation-notice`);
			await recipient.getByRole("button", { name: "Đánh dấu đã đọc" }).click();
			await expect(recipient.getByText(/0 chưa đọc/)).toBeVisible();
			await recipient.reload({ waitUntil: "domcontentloaded" });
			await recipient.getByRole("button", { name: /Thông báo hủy đặt chỗ/ }).click();
			await expect(recipient.getByText(/0 chưa đọc/)).toBeVisible();
			await captureEvidence(recipient, `23-real-api-${role}-read-state-after-reload`);
		} finally {
			await recipient.close();
		}
	}
});

test("paid booking keeps a 120-minute hold and the new policy snapshot", async ({ page }) => {
	const token = await login(page, emails.camper);
	const response = await page.request.post(`${API}/bookings`, {
		headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": randomUUID() },
		data: { tripId: paidTripId, numPeople: 1 },
	});
	expect(response.status()).toBe(201);
	const booking = (await response.json()) as {
		id: string;
		createdAt: string;
		holdExpiresAt: string;
		cancellationPolicySnapshot: {
			rules: Array<{ minHoursBeforeTrip: number; refundPercent: number }>;
		};
	};
	expect(new Date(booking.holdExpiresAt).getTime() - new Date(booking.createdAt).getTime()).toBe(
		120 * 60_000
	);
	expect(booking.cancellationPolicySnapshot.rules).toEqual([
		{ minHoursBeforeTrip: 72, refundPercent: 100 },
		{ minHoursBeforeTrip: 48, refundPercent: 30 },
		{ minHoursBeforeTrip: 0, refundPercent: 0 },
	]);
	await page.goto(`/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByText("Hủy trước ít nhất 72 giờ: hoàn 100% phần tiền đủ điều kiện.")
	).toBeVisible();
	await expect(
		page.getByText("Hủy trước ít nhất 48 giờ: hoàn 30% phần tiền đủ điều kiện.")
	).toBeVisible();
	await captureEvidence(page, "24-real-api-hold-120-minutes-refund-policy");
});

test("Porter assigned dashboard renders its persisted route through the real API", async ({
	browser,
}) => {
	const porterId = accountIds.porter;
	const tripId = db<{ id: string }>("seed-published-trip", {
		hostId: accountIds.host,
		routeId,
		createdBy: accountIds.camper,
		title: `E2E evidence Porter route ${suffix}`,
		pricePerPerson: "0.00",
	}).id;
	tripIds.push(tripId);
	db("seed-member-status-fixture", {
		tripId,
		ownerId: accountIds.camper,
		bookingStatus: "confirmed",
		porterId,
		timing: "pre_start",
	});
	const porterPage = await browser.newPage({
		baseURL: "http://localhost:5176",
		ignoreHTTPSErrors: true,
	});
	try {
		await login(porterPage, emails.porter);
		await porterPage.unroute("https://**/*");
		await porterPage.goto("/dashboard", { waitUntil: "domcontentloaded" });
		await expect(
			porterPage.getByRole("heading", { name: `E2E evidence Porter route ${suffix}`, exact: true })
		).toBeVisible();
		const map = porterPage.getByTestId("checkpoint-map");
		await expect(map).toBeVisible();
		await expect(map).toHaveAttribute("data-map-mode", "maplibre", { timeout: 30000 });
		await map.scrollIntoViewIfNeeded();
		await expect(map).toHaveAttribute("data-map-rendered", "true", { timeout: 60000 });
		await captureEvidence(porterPage, "25-real-api-porter-assigned-dashboard");
		if (process.env.CTMS_EVIDENCE_DIR)
			await map.locator("..").screenshot({
				path: path.join(process.env.CTMS_EVIDENCE_DIR, "26-real-api-porter-assigned-map.png"),
				animations: "disabled",
			});
	} finally {
		await porterPage.close();
	}
});

test("Camper discovers a Trip from the dashboard, opens its details and books it", async ({
	page,
}) => {
	const discoveryTripId = db<{ id: string }>("seed-published-trip", {
		hostId: accountIds.host,
		routeId,
		createdBy: accountIds.camper,
		title: `E2E mentor discovery ${suffix}`,
		pricePerPerson: "0.00",
	}).id;
	tripIds.push(discoveryTripId);
	await login(page, emails.camper);
	await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
	const panel = page.locator("#camper-active-trip");
	const title = `E2E mentor discovery ${suffix}`;
	for (let visited = 0; visited < 100; visited++) {
		await expect(panel.getByText("Đang tải chuyến đi...", { exact: true })).toHaveCount(0);
		if (await panel.getByRole("heading", { name: title, exact: true }).count()) break;
		const next = panel.getByRole("button", { name: "Chuyến tiếp" });
		await expect(next).toBeEnabled();
		await next.click();
	}
	await expect(panel.getByRole("heading", { name: title, exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Khám phá thêm chuyến đi" })).toHaveCount(0);
	await page.getByRole("button", { name: "Khám phá chuyến đi", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/trips/${discoveryTripId}$`));
	await expect(
		page.getByRole("heading", { name: `E2E mentor discovery ${suffix}`, exact: true })
	).toBeVisible();
	const booked = page.waitForResponse(
		(response) => response.url() === `${API}/bookings` && response.request().method() === "POST"
	);
	await page.getByRole("button", { name: "Đặt chỗ ngay", exact: true }).click();
	expect((await booked).status()).toBe(201);
	await expect(page.getByText("Đặt chỗ đã được xác nhận", { exact: true })).toBeVisible();
});

import { execFileSync } from "node:child_process";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";

const API_ROOT = path.resolve(process.cwd(), "../../services/api");
const TS_NODE = path.join(API_ROOT, "node_modules/ts-node/dist/bin.js");
const DB_HELPER = path.join(API_ROOT, "src/seeds/db-helper.ts");
const API = process.env.CTMS_E2E_API_BASE_URL ?? "http://localhost:3000/api";
const PASSWORD = "S3curePass!";
const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const hostEmail = `e2e-ctms37-host-${suffix}@example.com`;
const porterEmail = `e2e-ctms37-porter-${suffix}@example.com`;
const camperEmail = `e2e-ctms37-camper-${suffix}@example.com`;

function db<T>(action: string, payload: unknown): T {
	return JSON.parse(
		execFileSync(
			process.execPath,
			[TS_NODE, DB_HELPER, action, Buffer.from(JSON.stringify(payload)).toString("base64")],
			{ cwd: API_ROOT }
		).toString()
	) as T;
}

async function login(page: Page, email: string) {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

interface Fixture {
	tripId: string;
	bookingId: string;
	memberId: string;
	title: string;
}

test.describe("CTMS-37-T02 update member check-in status", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(120_000);
	let hostId = "";
	let porterId = "";
	let camperId = "";
	let routeId = "";
	const fixtures: Fixture[] = [];

	function createFixture(
		name: string,
		timing: "pre_start" | "post_start",
		bookingStatus: "confirmed" | "cancelled" | "expired",
		assignedPorter = false
	): Fixture {
		const title = `E2E CTMS37 ${name} ${suffix}`;
		const tripId = db<{ id: string }>("seed-published-trip", {
			hostId,
			routeId,
			title,
			createdBy: camperId,
			pricePerPerson: "0.00",
		}).id;
		const seeded = db<{ bookingId: string; memberId: string }>("seed-member-status-fixture", {
			tripId,
			ownerId: camperId,
			timing,
			bookingStatus,
			porterId: assignedPorter ? porterId : undefined,
		});
		const fixture = { tripId, title, ...seeded };
		fixtures.push(fixture);
		return fixture;
	}

	let preStart: Fixture;
	let postStart: Fixture;
	let blocked: Fixture;
	let porterTrip: Fixture;
	let conflictTrip: Fixture;

	test.beforeAll(() => {
		const createAccount = (email: string, role: "host" | "porter" | "camper") =>
			db<{ id: string }>("create-account", {
				email,
				phone: `09${Math.floor(Math.random() * 100000000)
					.toString()
					.padStart(8, "0")}`,
				password: PASSWORD,
				role,
				status: "active",
			}).id;
		hostId = createAccount(hostEmail, "host");
		porterId = createAccount(porterEmail, "porter");
		camperId = createAccount(camperEmail, "camper");
		routeId = db<{ routes: Array<{ id: string }> }>("seed-trekking-routes", {
			hostId,
			routes: [{ name: `E2E CTMS37 Route ${suffix}`, status: "active" }],
		}).routes[0].id;
		preStart = createFixture("pre-start", "pre_start", "confirmed");
		postStart = createFixture("post-start", "post_start", "confirmed");
		blocked = createFixture("blocked", "pre_start", "cancelled");
		porterTrip = createFixture("porter", "pre_start", "confirmed", true);
		conflictTrip = createFixture("conflict", "pre_start", "confirmed");
	});

	test.afterAll(() => {
		const tripIds = fixtures.map((fixture) => fixture.tripId);
		for (const [action, payload] of [
			["clean-bookings", { tripIds }],
			["clean-trips", { tripIds }],
			["clean-trekking-routes", { routeIds: [routeId] }],
		] as const) {
			try {
				db(action, payload);
			} catch (error) {
				console.error(error);
			}
		}
		for (const email of [camperEmail, porterEmail, hostEmail]) {
			try {
				execFileSync(process.execPath, [TS_NODE, DB_HELPER, "clean-user", email], {
					cwd: API_ROOT,
				});
			} catch (error) {
				console.error(error);
			}
		}
	});

	test("Host marks a pre-start member joined once and F5 restores the status", async ({ page }) => {
		await login(page, hostEmail);
		await page.goto(`/trips/${preStart.tripId}`);
		const row = page.locator(`[data-member-id="${preStart.memberId}"]`);
		await expect(row).toContainText(camperEmail);

		let patchCount = 0;
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(
			`**/api/trips/${preStart.tripId}/bookings/${preStart.bookingId}/members/${preStart.memberId}/status`,
			async (route) => {
				patchCount += 1;
				const response = await route.fetch();
				await held;
				await route.fulfill({ response });
			}
		);
		const joined = row.getByRole("button", { name: /Đánh dấu .* đã tham gia/ });
		await joined.click();
		await expect(row.getByRole("status")).toContainText("Đang cập nhật trạng thái");
		await joined.evaluate((button: HTMLButtonElement) => button.click());
		await expect.poll(() => patchCount).toBe(1);
		release();
		await expect(row.getByText("Đã tham gia", { exact: true })).toBeVisible();
		await expect(row.getByRole("button")).toHaveCount(0);
		await page.reload();
		await expect(
			page.locator(`[data-member-id="${preStart.memberId}"]`).getByText("Đã tham gia", {
				exact: true,
			})
		).toBeVisible();
	});

	test("Host marks no-show after start and blocked Booking stays read-only", async ({ page }) => {
		await login(page, hostEmail);
		await page.goto(`/trips/${postStart.tripId}`);
		const row = page.locator(`[data-member-id="${postStart.memberId}"]`);
		await row.getByRole("button", { name: /Đánh dấu .* không tham gia/ }).click();
		await page.getByTestId("confirm-modal-submit").click();
		await expect(row.getByText("Không tham gia", { exact: true })).toBeVisible();
		await page.reload();
		await expect(
			page.locator(`[data-member-id="${postStart.memberId}"]`).getByText("Không tham gia", {
				exact: true,
			})
		).toBeVisible();

		await page.goto(`/trips/${blocked.tripId}`);
		const blockedRow = page.locator(`[data-member-id="${blocked.memberId}"]`);
		await expect(blockedRow).toContainText("không đủ điều kiện cập nhật điểm danh");
		await expect(blockedRow.getByRole("button")).toHaveCount(0);
	});

	test("assigned Porter opens the operational roster and updates a member", async ({ page }) => {
		await login(page, porterEmail);
		await page.goto("/dashboard");
		const assignedTrip = page.locator("li", { hasText: porterTrip.title });
		await assignedTrip.getByRole("button", { name: /Mở danh sách/i }).click();
		await expect(page).toHaveURL(new RegExp(`/trips/${porterTrip.tripId}\\?view=roster`));
		const row = page.locator(`[data-member-id="${porterTrip.memberId}"]`);
		await row.getByRole("button", { name: /Đánh dấu .* đã tham gia/ }).click();
		await expect(row.getByText("Đã tham gia", { exact: true })).toBeVisible();
	});

	test("a stale conflict refetches and renders authoritative member state", async ({ page }) => {
		await login(page, hostEmail);
		await page.goto(`/trips/${conflictTrip.tripId}`);
		const row = page.locator(`[data-member-id="${conflictTrip.memberId}"]`);
		await expect(row.getByText("Đã đăng ký", { exact: true })).toBeVisible();
		db("set-e2e-booking-member-status", {
			memberId: conflictTrip.memberId,
			status: "joined",
		});
		const conflict = page.waitForResponse(
			(response) =>
				response.url() ===
				`${API}/trips/${conflictTrip.tripId}/bookings/${conflictTrip.bookingId}/members/${conflictTrip.memberId}/status`
		);
		await row.getByRole("button", { name: /Đánh dấu .* không tham gia/ }).click();
		await page.getByTestId("confirm-modal-submit").click();
		expect((await conflict).status()).toBe(409);
		await expect(
			page.getByText(/Danh sách đã thay đổi hoặc thao tác không còn khả dụng/)
		).toBeVisible();
		await expect(row.getByText("Đã tham gia", { exact: true })).toBeVisible();
	});
});

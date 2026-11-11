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
 * CTMS-36-T02. Cancel Trip Due to Insufficient Participants (UI E2E).
 *
 * Drives the REAL CTMS-036 worker logic (via TripAutoCancelService, not a
 * client-triggered HTTP call -- this is a background job per the spec, see
 * `file/spec/ctms-36-cancel-trip-due-to-insufficient-participants.md` section 9)
 * against a Trip whose booking deadline already passed with confirmed
 * participation below `capacity_min`, then verifies the Camper-facing UI
 * (CTMS-179) reflects it correctly:
 * 1. Trip detail page shows a clear "cancelled" banner with the known reason text.
 * 2. Booking details page shows the cancelled-booking message (no stale/contradictory text).
 * 3. The refund panel shows the pending refund obligation WITHOUT the pre-Trip
 *    "Khung thời gian yêu cầu" window box -- that box only renders for
 *    `CAMPER_CANCELLATION` origin, so its absence here proves the backend's
 *    origin-mislabeling bug (RefundsService.getBookingRefundInfo) is fixed and
 *    this refund is correctly attributed to SYSTEM_TRIP_CANCELLATION.
 */
test.describe("CTMS-36-T02 Cancel Trip Due to Insufficient Participants (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(90_000);

	const hostEmail = email("ctms36t02-host");
	const camperEmail = email("ctms36t02-camper");
	const routeName = `E2E CTMS36T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS36T02 Trip ${Date.now()}`;
	let hostId = "";
	let camperId = "";
	let routeId = "";
	let tripId = "";
	let bookingId = "";

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
		// capacityMin: 3 and a single 1-person Booking -- confirmed participation (1) stays
		// below capacity_min (3). bookingDeadlineOffsetHours: -1 puts booking_deadline
		// an hour in the past so the worker's eligibility check (deadline passed) is met,
		// while the Trip's starts_at (always now() + 5 days in this fixture) stays far in
		// the future, matching the real-world "evaluated well before the Trip itself runs" case.
		tripId = db<{ id: string }>("seed-published-trip", {
			hostId,
			routeId,
			title: tripTitle,
			pricePerPerson: "500000.00",
			createdBy: camperId,
			capacityMin: 3,
			bookingDeadlineOffsetHours: -1,
		}).id;
		const seeded = db<{ bookingId: string }>("seed-confirmed-booking-with-charge", {
			tripId,
			camperId,
			amount: "500000.00",
		});
		bookingId = seeded.bookingId;

		const autoCancel = db<{ id: string; result: string }>("auto-cancel-trip-through-service", {
			tripId,
		});
		expect(autoCancel.result).toBe("cancelled");
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

	test("Trip detail shows the cancelled banner with the known auto-cancel reason", async ({
		page,
	}) => {
		// Viewed as the owning Host, not the Camper: GET /trips/:id already
		// restricts a non-published Trip to its owning Host or an Admin for any
		// non-published status (BR-073/075, trips.service.ts's getTripDetails --
		// pre-existing, deliberately covered by its own unit tests, out of this
		// story's scope to change). The Camper-facing surface for a cancelled
		// Booking is the Booking details page, verified in the next test below.
		await login(page, hostEmail);
		await page.goto(`/trips/${tripId}`);

		const banner = page.getByTestId("trip-capacity-banner-cancelled");
		await expect(banner).toBeVisible();
		await expect(banner).toContainText("Chuyến đi đã bị hủy");
		await expect(banner).toContainText(
			"Chuyến đi không đạt đủ số lượng người tham gia tối thiểu trước hạn chót đặt chỗ."
		);
	});

	test("Booking details shows the cancelled message and a correctly-attributed pending refund", async ({
		page,
	}) => {
		await login(page, camperEmail);
		await page.goto(`/bookings/${bookingId}`);

		// BookingCancellationPanel: clear cancelled-booking message, no stale fallback text.
		await expect(
			page.getByText("Đơn đặt chỗ đã hủy và không còn quyền tham gia chuyến đi.")
		).toBeVisible();
		await expect(
			page.getByText("Thông tin hoàn tiền không có trong dữ liệu chi tiết hiện tại.")
		).toHaveCount(0);

		// BookingRefundPanel: pending refund obligation from the auto-cancel worker is visible,
		// already committed for the full charged amount (BR-105: a pending refund counts against
		// the cap just like a succeeded one), so nothing remains refundable on top of it.
		await expect(page.getByRole("heading", { name: "Thông tin hoàn tiền" })).toBeVisible();
		await expect(page.getByText("Số tiền đã thanh toán:")).toBeVisible();
		await expect(page.getByTestId("remaining-refundable-amount")).toContainText("0");
		await expect(page.getByTestId("refund-status-badge-pending").first()).toBeVisible();
		await expect(page.getByText("Lịch sử hoàn tiền")).toBeVisible();
		await expect(page.getByText("500.000").first()).toBeVisible();

		// ...and attributed to the Trip's own System cancellation, not a Camper
		// pre-Trip cancellation -- proven by the ABSENCE of the pre-Trip request
		// window box, which refunds.service.ts only populates for CAMPER_CANCELLATION.
		await expect(page.getByText("Khung thời gian yêu cầu:")).toHaveCount(0);

		// No "submit a new refund request" button either: one is already pending.
		await expect(page.getByTestId("open-refund-request-modal")).toHaveCount(0);
		await expect(
			page.getByText("Đang có yêu cầu hoàn tiền chờ Quản trị viên đối soát.")
		).toBeVisible();
	});

	test("DB verification: Booking cancelled and refund obligation tagged with the CTMS-036 idempotency prefix", async () => {
		const { booking, payments } = db<{
			booking: { status: string; paymentStatus: string };
			payments: Array<{ status: string; type: string; idempotencyKey: string }>;
		}>("get-booking", { tripId, userId: camperId });

		expect(booking).toMatchObject({ status: "cancelled" });

		const refundRow = payments.find((p) => p.type === "refund");
		expect(refundRow).toBeDefined();
		expect(refundRow?.status).toBe("pending");
		expect(refundRow?.idempotencyKey).toMatch(/^ctms-036:trip-cancel:/);
	});
});

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

async function login(page: Page, userEmail: string) {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill(userEmail);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.locator('form button[type="submit"]').click();
	await expect.poll(() => page.evaluate(() => localStorage.getItem("accessToken"))).toBeTruthy();
}

test.describe("CTMS-30-T02 Add Members to Booking (UI)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(60_000);
	const hostEmail = email("ctms30t02-host");
	const ownerEmail = email("ctms30t02-owner");
	const participantEmail = email("ctms30t02-participant");
	const routeName = `E2E CTMS30T02 Route ${Date.now()}`;
	const tripTitle = `E2E CTMS30T02 Trip ${Date.now()}`;
	let hostId = "";
	let ownerId = "";
	let participantId = "";
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
	});

	test.afterEach(() => {
		db("clean-bookings", { tripIds: [tripId] });
	});

	test.afterAll(() => {
		for (const [action, payload] of [
			["clean-trips", { tripIds: [tripId] }],
			["clean-trekking-routes", { routeIds: [routeId] }],
		] as const) {
			try {
				db(action, payload);
			} catch (error) {
				console.error(error);
			}
		}
		for (const userEmail of [hostEmail, ownerEmail, participantEmail]) {
			try {
				execFileSync(process.execPath, [TS_NODE_BIN, DB_HELPER, "clean-user", userEmail], {
					cwd: API_ROOT,
				});
			} catch (error) {
				console.error(error);
			}
		}
	});

	async function createTwoPersonBooking(page: Page) {
		await login(page, ownerEmail);
		await page.goto(`/trips/${tripId}`);
		await expect(page.getByText(tripTitle)).toBeVisible();
		await page.getByTestId("num-people-value").fill("2");
		await page.getByRole("button", { name: "Đặt chỗ ngay" }).click();
		await expect(page.getByText("Đã tạo đặt chỗ thành công")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Xác nhận người tham gia" })).toBeVisible();
	}

	async function resolveParticipant(page: Page) {
		await page.getByLabel("Email người tham gia 1").fill(participantEmail);
		await page.getByRole("button", { name: "Xác nhận email" }).click();
		await expect(page.getByText(`Đã xác nhận: ${participantEmail}`)).toBeVisible();
	}

	test("initializes the complete participant roster after creating a Booking", async ({ page }) => {
		await createTwoPersonBooking(page);
		await resolveParticipant(page);
		await page.getByRole("button", { name: "Xác nhận danh sách" }).click();

		const roster = page
			.getByRole("status")
			.filter({ hasText: "Danh sách người tham gia đã được xác nhận" });
		await expect(roster).toBeVisible();
		await expect(roster).toContainText("Bạn");
		await expect(roster).toContainText(participantEmail);
		await expect(roster).toContainText("registered");

		const { members } = db<{
			members: Array<{ userId: string; isPrimary: boolean; memberStatus: string }>;
		}>("get-booking", { tripId, userId: ownerId });
		expect(members).toEqual([
			{ userId: ownerId, isPrimary: true, memberStatus: "registered" },
			{ userId: participantId, isPrimary: false, memberStatus: "registered" },
		]);
	});

	test("shows the authoritative conflict when the roster was already initialized", async ({
		page,
	}) => {
		await createTwoPersonBooking(page);
		await resolveParticipant(page);
		const { booking } = db<{ booking: { id: string } }>("get-booking", {
			tripId,
			userId: ownerId,
		});
		const accessToken = await page.evaluate(() => localStorage.getItem("accessToken"));
		const response = await page.request.post(`${API_BASE_URL}/bookings/${booking.id}/members`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Idempotency-Key": crypto.randomUUID(),
			},
			data: { members: [{ userId: participantId }] },
		});
		expect(response.status()).toBe(201);

		await page.getByRole("button", { name: "Xác nhận danh sách" }).click();
		await expect(page.getByRole("alert")).toContainText("already initialized");
	});
});

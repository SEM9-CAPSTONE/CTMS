import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test } from "@playwright/test";

const evidenceTrip =
	process.env.CTMS306_DEV_EVIDENCE === "1"
		? "306de000-0000-4000-8000-000000000151"
		: "306de000-0000-4000-8000-000000000061";
const evidenceApi = process.env.CTMS306_API_URL ?? "http://127.0.0.1:3019/api";
test.beforeAll(async () => {
	if (process.env.CTMS306_DEV_EVIDENCE === "1") {
		if (process.env.CI || evidenceApi !== "http://127.0.0.1:3000/api")
			throw Error("Explicit local dev evidence only");
		return;
	}
	// Repeatable unread fixture in the isolated UI database; never the dev database.
	const database =
		process.env.TEST_DATABASE_URL ??
		"postgresql://ctms:ctms@127.0.0.1:5432/ctms306_host_review_test";
	if (new URL(database).pathname !== "/ctms306_host_review_test")
		throw new Error("Requires ctms306_host_review_test");
	const apiRequire = createRequire(path.resolve(process.cwd(), "../../services/api/package.json"));
	const { Client } = apiRequire("pg") as {
		Client: new (options: { connectionString: string }) => {
			connect(): Promise<void>;
			end(): Promise<void>;
			query(sql: string, values?: unknown[]): Promise<unknown>;
		};
	};
	const db = new Client({ connectionString: database });
	await db.connect();
	try {
		await db.query(
			"UPDATE offline_package_departure_notifications SET read_at=NULL WHERE trip_id=$1 AND recipient_id=(SELECT id FROM users WHERE email='host@ctms.local')",
			[evidenceTrip]
		);
	} finally {
		await db.end();
	}
});

test.skip("Host cancels its overdue published blocked demo through the real API", async ({
	page,
}) => {
	const trip = "306de000-0000-4000-8000-000000000041";
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill("Host@123");
	await page.locator('form button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
	await page.goto(`/trips/${trip}`);
	await expect(page.getByTestId("departure-block-status")).toContainText("Chưa sẵn sàng khởi hành");
	await page.getByRole("button", { name: "Huỷ chuyến", exact: true }).click();
	await page
		.getByPlaceholder("Nhập lý do huỷ để ghi nhận lịch sử thao tác")
		.fill("CTMS-306 isolated E2E: cancel overdue blocked demo");
	await page.screenshot({
		path: "../../artifacts/ctms306-host-cancel-before-full.png",
		fullPage: true,
	});
	const [response] = await Promise.all([
		page.waitForResponse(
			(r) => r.url().endsWith(`/trips/${trip}/cancel`) && r.request().method() === "PATCH"
		),
		page.getByRole("button", { name: "Huỷ chuyến đi", exact: true }).click(),
	]);
	expect(response.status()).toBe(200);
	const payload: unknown = await response.json();
	const status =
		typeof payload === "object" && payload !== null && "status" in payload ? payload.status : null;
	expect(status).toBe("cancelled");
	await expect(page.getByRole("button", { name: "Huỷ chuyến đi", exact: true })).toHaveCount(0);
	await page.screenshot({
		path: "../../artifacts/ctms306-host-cancel-after-full.png",
		fullPage: true,
	});
	await writeFile(
		path.resolve(process.cwd(), "../../artifacts/ctms306-host-cancel-evidence.json"),
		JSON.stringify(
			{
				tripId: trip,
				before: "published, overdue, departure blocked",
				method: "PATCH",
				httpStatus: response.status(),
				after: status,
				reasonEntered: true,
			},
			null,
			2
		)
	);
});

test("Host reads a real blocked-departure notice and marks it read", async ({ page }) => {
	await page.goto("/login");
	await page.locator('input[type="text"]').first().fill("host@ctms.local");
	await page.locator('input[type="password"]').fill("Host@123");
	await page.locator('form button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
	await page.goto(`/trips/${evidenceTrip}`);
	const toggle = page.getByRole("button", { name: /Thông báo khởi hành/ });
	await expect(toggle).toBeVisible();
	await toggle.click();
	const notice = page
		.locator("li")
		.filter({ has: page.locator(`a[href="/trips/${evidenceTrip}"]`) });
	const tripLink = notice.getByRole("link", { name: "Xem chuyến đi", exact: true });
	const status = () =>
		page.evaluate(
			async ({ api, trip }) => {
				const response = await fetch(
					`${api}/trips/${trip}/offline-package-policy/departure-status`,
					{
						headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
					}
				);
				if (!response.ok) throw new Error(`Departure status HTTP ${response.status}`);
				return response.json() as Promise<{ blocked: boolean; reasonCode: string | null }>;
			},
			{ api: evidenceApi, trip: evidenceTrip }
		);
	const before = await status();
	expect(before.blocked).toBe(true);
	await expect(notice.getByText("Chưa sẵn sàng khởi hành", { exact: true })).toBeVisible();
	await expect(tripLink).toHaveAttribute("href", `/trips/${evidenceTrip}`);
	const unread = page.getByRole("button", { name: "Đánh dấu đã đọc", exact: true });
	await expect(unread.first()).toBeVisible();
	const count = await unread.count();
	await expect(toggle.getByLabel("Chưa đọc")).toHaveText(`(${count})`);
	await notice.getByRole("button", { name: "Đánh dấu đã đọc", exact: true }).click();
	await expect(unread).toHaveCount(count - 1);
	await expect(toggle.getByLabel("Chưa đọc")).toHaveText(`(${count - 1})`);
	const inboxSection = page.locator("section").filter({ has: toggle });
	await expect(inboxSection.getByText("Đã đọc", { exact: true }).first()).toBeVisible();
	await inboxSection.screenshot({ path: "../../artifacts/ctms306-v5-host-inbox-after-read.png" });
	await inboxSection.screenshot({ path: "../../artifacts/ctms306-host-inbox-content.png" });
	const after = await status();
	expect(after.blocked).toBe(true);
	expect(after.reasonCode).toBe(before.reasonCode);
	await writeFile(
		path.resolve(process.cwd(), "../../artifacts/ctms306-v5-host-evidence.json"),
		JSON.stringify(
			{
				beforeUnread: count,
				afterUnread: count - 1,
				beforeBlocked: before.blocked,
				afterBlocked: after.blocked,
				reasonCode: after.reasonCode,
			},
			null,
			2
		)
	);
	await expect(page.getByText("DEPARTURE_NOT_CONFIRMED", { exact: true })).toHaveCount(0);
	await tripLink.click();
	await expect(page.getByTestId("departure-block-status")).toBeVisible();
	await expect(page.getByTestId("departure-block-status")).toContainText("Chưa sẵn sàng khởi hành");
	await page.getByTestId("departure-block-status").screenshot({
		path: "../../artifacts/ctms306-v5-host-block-after-read.png",
	});
	await page
		.locator("main")
		.last()
		.screenshot({ path: "../../artifacts/ctms306-host-trip-content.png" });
});

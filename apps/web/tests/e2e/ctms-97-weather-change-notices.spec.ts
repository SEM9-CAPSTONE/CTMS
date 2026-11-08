import { type Page, expect, test } from "@playwright/test";

/**
 * CTMS-97 (CTMS-15-T02): Host and Camper see the forecast level-change notices from the CTMS-93
 * monitor, and travellers can open how the Trip-date forecast changed over time.
 * The backend is mocked; the realtime push itself is covered by the Vitest suite.
 */

const TRIP_ID = "7b0a3c5e-97a1-4c2e-9d10-0f5f4b1e9701";
const DAY = 24 * 60 * 60 * 1000;
const startsAt = new Date(Date.now() + 5 * DAY).toISOString();
const endsAt = new Date(Date.now() + 6 * DAY).toISOString();

interface NoticeFixture {
	id: string;
	readAt: string | null;
	message: string;
	[key: string]: unknown;
}

function notice(overrides: Record<string, unknown> = {}): NoticeFixture {
	return {
		id: "0c9d1a2b-97a1-4c2e-9d10-0f5f4b1e9702",
		tripId: TRIP_ID,
		forecastId: "f-2",
		tripTitle: "Tà Năng – Phan Dũng",
		tripStartsAt: startsAt,
		previousRiskLevel: "green",
		riskLevel: "red",
		worsened: true,
		message: "Cảnh báo sớm: dự báo ngày 17/11 xấu đi (Xanh → Đỏ), đang theo dõi.",
		readAt: null,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function forecast(overrides: Record<string, unknown> = {}) {
	return {
		id: "f-2",
		tripId: TRIP_ID,
		status: "available",
		tripStartsAt: startsAt,
		tripEndsAt: endsAt,
		forecastFrom: startsAt,
		forecastTo: endsAt,
		coversWholeTrip: true,
		worstReading: null,
		riskLevel: "red",
		compositeScore: 2.6,
		criteriaScores: null,
		advice: null,
		horizonDays: 15,
		createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
		checkedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
		...overrides,
	};
}

const trip = {
	id: TRIP_ID,
	hostId: "host-97",
	routeId: "route-97",
	title: "Tà Năng – Phan Dũng",
	description: "Cung đường đồi cỏ",
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "public",
	durationNights: 1,
	startsAt,
	endsAt,
	meetingPoint: { type: "Point", coordinates: [108.4, 11.6] },
	meetingAt: null,
	bookingDeadline: new Date(Date.now() + 3 * DAY).toISOString(),
	capacityMin: 2,
	capacityMax: 10,
	seatsTaken: 2,
	pricePerPerson: 1500000,
	cancellationPolicy: null,
	status: "published",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	waypoints: [],
};

async function signIn(page: Page, role: "host" | "camper") {
	const user = {
		id: `${role}-97`,
		role,
		roles: [role],
		status: "active",
		email: `${role}97@example.test`,
		fullName: `${role} 97`,
		createdAt: "2026-01-01",
	};
	// These UI tests mock the backend, so the authenticated realtime channel is mocked too.
	await page.routeWebSocket(/\/socket\.io\//, () => {});
	await page.addInitScript((user) => {
		localStorage.setItem("authUser", JSON.stringify(user));
		localStorage.setItem("accessToken", "test-token");
	}, user);
	await page.route("https://**/*", (route) => route.abort());
	await page.route(
		(url) => url.pathname.startsWith("/api/"),
		(route) => {
			const path = new URL(route.request().url()).pathname;
			if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
			if (path.includes("/profile")) {
				return route.fulfill({ json: { ...user, emergencyContacts: [], languages: [] } });
			}
			return route.fulfill({ json: [] });
		}
	);
	return user;
}

async function mockInbox(page: Page, initial: NoticeFixture[]) {
	let items = initial;
	const reads: string[] = [];
	await page.route("**/api/me/weather-notices", (route) =>
		route.fulfill({
			json: { items, unreadCount: items.filter((item) => !item.readAt).length },
		})
	);
	await page.route("**/api/me/weather-notices/*/read", (route) => {
		const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
		reads.push(id);
		items = items.map((item) =>
			item.id === id ? { ...item, readAt: new Date().toISOString() } : item
		);
		return route.fulfill({ json: items.find((item) => item.id === id) });
	});
	return reads;
}

test("Host reads a forecast level change from the weather inbox", async ({ page }, testInfo) => {
	await signIn(page, "host");
	const improved = notice({
		id: "0c9d1a2b-97a1-4c2e-9d10-0f5f4b1e9703",
		forecastId: "f-3",
		previousRiskLevel: "red",
		riskLevel: "yellow",
		worsened: false,
		message: "Dự báo ngày 17/11 đã cải thiện (Đỏ → Vàng).",
		readAt: new Date().toISOString(),
	});
	const reads = await mockInbox(page, [notice(), improved]);
	await page.goto("/dashboard");

	const bell = page.getByRole("button", { name: "Thông báo thời tiết (1 chưa đọc)" });
	await expect(bell).toBeVisible();
	await bell.click();
	const dialog = page.getByRole("dialog", { name: "Thông báo thời tiết" });
	await expect(dialog.getByText(notice().message)).toBeVisible();
	await expect(dialog.getByText(improved.message)).toBeVisible();
	await expect(dialog.getByTestId("weather-change-notice").first()).toHaveAttribute(
		"data-worsened",
		"true"
	);
	await expect(dialog.getByRole("link", { name: "Tà Năng – Phan Dũng" }).first()).toHaveAttribute(
		"href",
		`/trips/${TRIP_ID}`
	);
	await dialog.screenshot({ path: testInfo.outputPath("host-weather-inbox.png") });

	await dialog.getByRole("button", { name: "Đánh dấu đã đọc" }).click();
	await expect(
		dialog.getByRole("heading", { name: "Thông báo thời tiết (0 chưa đọc)" })
	).toBeVisible();
	expect(reads).toEqual([notice().id]);
	await expect(dialog.getByRole("button", { name: "Đánh dấu đã đọc" })).toHaveCount(0);
});

test("Camper sees the weather inbox and the forecast change history of a Trip", async ({
	page,
}, testInfo) => {
	await signIn(page, "camper");
	await mockInbox(page, [notice()]);
	await page.route(`**/api/trips/${TRIP_ID}`, (route) => route.fulfill({ json: trip }));
	await page.route(`**/api/trips/${TRIP_ID}/weather-forecast/trip-dates`, (route) =>
		route.fulfill({ json: forecast() })
	);
	let historyRequests = 0;
	await page.route(`**/api/trips/${TRIP_ID}/weather-forecast/history`, (route) => {
		historyRequests += 1;
		return route.fulfill({
			json: [
				forecast(),
				forecast({
					id: "f-1",
					riskLevel: "green",
					compositeScore: 0.4,
					createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
					checkedAt: new Date(Date.now() - DAY).toISOString(),
				}),
			],
		});
	});

	await page.goto("/dashboard");
	await expect(
		page.getByRole("button", { name: "Thông báo thời tiết (1 chưa đọc)" })
	).toBeVisible();

	await page.goto(`/trips/${TRIP_ID}`);
	const card = page.getByTestId("trip-weather-forecast-card");
	await expect(card.getByTestId("trip-forecast-checked-at")).toContainText("Kiểm tra lần cuối:");
	const history = card.getByTestId("trip-weather-history");
	await expect(history).toBeVisible();
	expect(historyRequests).toBe(0);
	await history.getByText("Lịch sử thay đổi dự báo").click();
	const rows = history.getByTestId("trip-weather-history-entry");
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText("Nguy hiểm (Đỏ)");
	await expect(rows.nth(1)).toContainText("An toàn (Xanh)");
	await expect(rows.nth(1)).toContainText("Kiểm tra lần cuối");
	await card.screenshot({ path: testInfo.outputPath("camper-weather-history.png") });
});

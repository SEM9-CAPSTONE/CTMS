import { type Page, expect, test } from "@playwright/test";

/**
 * CTMS-60: UI of the weather decision near departure (CTMS-98 API, policy §5).
 * Host keeps a Red Trip, an Admin pauses then resumes one, and a Camper declines a weather
 * reschedule. The backend is mocked; the realtime refresh is covered by the Vitest suite.
 */

const TRIP_ID = "7b0a3c5e-60a1-4c2e-9d10-0f5f4b1e6001";
const BOOKING_ID = "3d2c1b0a-60a1-4c2e-9d10-0f5f4b1e6002";
const HOUR = 60 * 60 * 1000;
const startsAt = new Date(Date.now() + 40 * HOUR).toISOString();
const endsAt = new Date(Date.now() + 49 * HOUR).toISOString();

type Role = "host" | "admin" | "camper";

async function signIn(page: Page, role: Role) {
	const user = {
		id: `${role}-60`,
		role,
		roles: [role],
		status: "active",
		email: `${role}60@example.test`,
		fullName: `${role} 60`,
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
			if (path.includes("/profile") && !path.endsWith("/bank-accounts")) {
				return route.fulfill({ json: { ...user, emergencyContacts: [], languages: [] } });
			}
			if (path.endsWith("/me/weather-notices") || path.endsWith("/me/weather-decision-alerts")) {
				return route.fulfill({ json: { items: [], unreadCount: 0 } });
			}
			return route.fulfill({ json: [] });
		}
	);
	return user;
}

function decisionLog(overrides: Record<string, unknown> = {}) {
	return {
		tripId: TRIP_ID,
		tripStatus: "published",
		startsAt,
		weatherPausedAt: null,
		weatherPauseReason: null,
		latestRiskLevel: "red",
		withinDecisionWindow: true,
		decisions: [],
		...overrides,
	};
}

const trip = {
	id: TRIP_ID,
	hostId: "host-60",
	routeId: "route-60",
	title: "Tà Năng – Phan Dũng",
	description: "Cung đường đồi cỏ",
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt,
	endsAt,
	meetingPoint: { type: "Point", coordinates: [108.4, 11.6] },
	meetingAt: null,
	bookingDeadline: new Date(Date.now() + 20 * HOUR).toISOString(),
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

test("Host keeps a Red Trip with a reason and a safety plan", async ({ page }, testInfo) => {
	await signIn(page, "host");
	await page.route(`**/api/trips/${TRIP_ID}`, (route) => route.fulfill({ json: trip }));
	let posted: unknown = null;
	await page.route(`**/api/trips/${TRIP_ID}/weather-decisions`, (route) =>
		route.fulfill({ json: decisionLog() })
	);
	await page.route(`**/api/trips/${TRIP_ID}/weather-decision`, (route) => {
		posted = route.request().postDataJSON();
		return route.fulfill({
			status: 201,
			json: {
				id: "d-1",
				tripId: TRIP_ID,
				forecastId: "f-1",
				riskLevel: "red",
				decidedBy: "host-60",
				deciderName: "host 60",
				deciderRole: "host",
				decision: "keep",
				reason: "Porter quen tuyến",
				safetyPlan: "Quay đầu trước 14h nếu mưa",
				late: false,
				tripStartsAt: startsAt,
				createdAt: new Date().toISOString(),
			},
		});
	});

	await page.goto(`/trips/${TRIP_ID}`);
	const card = page.getByTestId("host-weather-decision-card");
	await expect(card).toBeVisible();
	await card.getByLabel("Lý do (bắt buộc)").fill("Porter quen tuyến");
	await card.getByLabel("Phương án an toàn (bắt buộc khi giữ)").fill("Quay đầu trước 14h nếu mưa");
	await card.screenshot({ path: testInfo.outputPath("host-weather-decision.png") });
	await card.getByRole("button", { name: "Gửi quyết định: Giữ" }).click();
	await page.getByTestId("confirm-modal").getByRole("button", { name: "Xác nhận" }).click();
	await expect(card.getByText("Đã ghi nhận quyết định: Giữ.")).toBeVisible();
	expect(posted).toEqual({
		decision: "keep",
		reason: "Porter quen tuyến",
		safetyPlan: "Quay đầu trước 14h nếu mưa",
	});
});

test("Admin pauses a Red Trip from the intervention list, then resumes it", async ({
	page,
}, testInfo) => {
	await signIn(page, "admin");
	let paused = false;
	const decisions: Array<{ decision: string; reason: string }> = [];
	await page.route("**/api/admin/weather-interventions", (route) =>
		route.fulfill({
			json: [
				{
					tripId: TRIP_ID,
					tripTitle: "Tà Năng – Phan Dũng",
					hostId: "host-60",
					startsAt: new Date(Date.now() + 5 * HOUR).toISOString(),
					forecastId: "f-1",
					reason: "no_response",
					urgency: "critical",
					hostDecisionReason: null,
					hostSafetyPlan: null,
					weatherPausedAt: paused ? new Date().toISOString() : null,
				},
			],
		})
	);
	await page.route(`**/api/trips/${TRIP_ID}/weather-decisions`, (route) =>
		route.fulfill({
			json: decisionLog({
				weatherPausedAt: paused ? new Date().toISOString() : null,
				weatherPauseReason: paused ? "Chờ cập nhật bão" : null,
			}),
		})
	);
	await page.route(`**/api/admin/trips/${TRIP_ID}/weather-decision`, (route) => {
		const body = route.request().postDataJSON() as { decision: string; reason: string };
		decisions.push(body);
		paused = body.decision === "pause";
		return route.fulfill({
			status: 201,
			json: { id: `d-${decisions.length}`, decision: body.decision, deciderRole: "admin" },
		});
	});

	await page.goto("/admin/weather-interventions");
	const row = page.getByTestId("weather-intervention-row");
	await expect(row).toContainText("Khẩn cấp");
	await expect(row).toContainText("Host chưa phản hồi");
	await page.screenshot({ path: testInfo.outputPath("admin-weather-interventions.png") });

	await row.click();
	let dialog = page.getByTestId("admin-weather-decision-dialog");
	await dialog.getByRole("button", { name: "Tạm dừng" }).click();
	await dialog.getByLabel("Lý do (bắt buộc)").fill("Chờ cập nhật bão");
	await dialog.getByRole("button", { name: "Gửi quyết định: Tạm dừng" }).click();
	await page.getByTestId("confirm-modal").getByRole("button", { name: "Xác nhận" }).click();
	await expect(dialog.getByText("Đã ghi nhận quyết định: Tạm dừng.")).toBeVisible();
	await page.getByRole("button", { name: "Đóng" }).first().click();

	await expect(row).toContainText("Đang tạm dừng");
	await row.click();
	dialog = page.getByTestId("admin-weather-decision-dialog");
	await expect(dialog.getByRole("button", { name: "Mở lại", exact: true })).toHaveAttribute(
		"aria-pressed",
		"true"
	);
	await dialog.getByLabel("Lý do (bắt buộc)").fill("Bão đã tan");
	await dialog.getByRole("button", { name: "Gửi quyết định: Mở lại" }).click();
	await page.getByTestId("confirm-modal").getByRole("button", { name: "Xác nhận" }).click();
	await expect(dialog.getByText("Đã ghi nhận quyết định: Mở lại.")).toBeVisible();
	expect(decisions).toEqual([
		{ decision: "pause", reason: "Chờ cập nhật bão" },
		{ decision: "resume", reason: "Bão đã tan" },
	]);
});

test("Camper declines a weather reschedule for a full refund", async ({ page }, testInfo) => {
	await signIn(page, "camper");
	let status = "pending_reconfirmation";
	const newStart = new Date(Date.now() + 10 * 24 * HOUR).toISOString();
	await page.route(`**/api/bookings/${BOOKING_ID}`, (route) =>
		route.fulfill({
			json: {
				id: BOOKING_ID,
				tripId: TRIP_ID,
				userId: "camper-60",
				numPeople: 1,
				status,
				weatherReschedulePending: status === "pending_reconfirmation",
				paymentStatus: status === "cancelled" ? "refund_pending" : "paid",
				holdExpiresAt: null,
				tripStartsAtSnapshot: newStart,
				tripEndsAtSnapshot: new Date(Date.parse(newStart) + 9 * HOUR).toISOString(),
				basePrice: "1500000.00",
				totalAmount: "1500000.00",
				cancellationPolicySnapshot: null,
				createdAt: "2026-11-01T00:00:00.000Z",
				tripPresentation: {
					id: TRIP_ID,
					currentTitle: "Tà Năng – Phan Dũng",
					routeId: "route-60",
					currentRouteName: "Tà Năng",
				},
				members: [],
				equipmentItems: [],
			},
		})
	);
	await page.route(`**/api/bookings/${BOOKING_ID}/refunds`, (route) =>
		route.fulfill({
			json: {
				bookingId: BOOKING_ID,
				isEligible: false,
				totalRefundedAmount: "0.00",
				remainingRefundableAmount: "0.00",
				refunds: [],
				settlementBlocked: false,
				awaitingResolution: false,
			},
		})
	);
	let answer: unknown = null;
	await page.route(`**/api/bookings/${BOOKING_ID}/weather-reschedule-response`, (route) => {
		answer = route.request().postDataJSON();
		status = "cancelled";
		return route.fulfill({
			json: { bookingId: BOOKING_ID, status: "cancelled", refundsCreated: 1 },
		});
	});

	await page.goto(`/bookings/${BOOKING_ID}`);
	const card = page.getByTestId("weather-reschedule-response-card");
	await expect(card).toContainText("Trip đã dời lịch");
	await card.screenshot({ path: testInfo.outputPath("camper-weather-reschedule.png") });
	await card.getByRole("button", { name: "Huỷ và hoàn 100%" }).click();
	await page.getByTestId("confirm-modal").getByRole("button", { name: "Xác nhận" }).click();
	await expect(page.getByTestId("weather-reschedule-response-card")).toHaveCount(0);
	expect(answer).toEqual({ accept: false });
});

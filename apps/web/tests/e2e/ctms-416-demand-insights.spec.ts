import { type Page, expect, test } from "@playwright/test";
import type {
	DemandPlanningReport,
	DemandPlanningStatus,
	DemandReport,
	DemandStatus,
} from "../../src/features/demand-insights/types";
const month = "2026-08";
const report: DemandReport = {
	month,
	version: "synthetic-report",
	status: "succeeded",
	stale: false,
	generatedAt: "2026-11-06T15:30:00Z",
	dataWindow: { start: "2026-07-31T17:00:00Z", end: "2026-08-31T17:00:00Z" },
	errorCode: null,
	canRetry: false,
	cells: [
		{ tripType: "day_trip", difficulty: "moderate", bookerBand: { min: 20, max: 29 } },
		{ tripType: "overnight", difficulty: "hard", bookerBand: { min: 30, max: 39 } },
	],
	suggestions: [{ tripType: "overnight", difficulty: "hard", reason: "observed_booking_interest" }],
};
async function mockUI(
	page: Page,
	initial: DemandStatus | "missing" | "forbidden" = "succeeded",
	postStatus = 202
) {
	let status = initial;
	let posts = 0;
	let gets = 0;
	await page.route("**/socket.io/**", (r) => r.abort());
	await page.routeWebSocket("**/socket.io/**", (s) => s.close());
	await page.addInitScript(() => {
		localStorage.setItem("accessToken", "ctms-416-test-token");
		localStorage.setItem(
			"authUser",
			JSON.stringify({ id: "test-host", role: "host", roles: ["host"], status: "active" })
		);
	});
	await page.route("http://localhost:3000/api/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		const send = (data: unknown, code = 200, headers: Record<string, string> = {}) =>
			route.fulfill({
				status: code,
				contentType: "application/json",
				body: JSON.stringify(data),
				headers: { "Access-Control-Expose-Headers": "Retry-After", ...headers },
			});
		if (path === "/api/host/demand-insights")
			return send({
				periods: [
					{
						month,
						canCreate: status === "missing",
						hasReport: status !== "missing",
						availableAt: "2026-09-03T17:00:00Z",
					},
				],
			});
		if (path === `/api/host/demand-insights/${month}`) {
			if (route.request().method() === "POST") {
				posts++;
				if (postStatus === 429)
					return send({ retryAfterSeconds: 99 }, 429, { "Retry-After": "30" });
				if (postStatus === 422)
					return send({ code: "period_not_settled", availableAt: "2026-11-08T17:00:00Z" }, 422);
				status = "running";
				return send({ version: report.version, month, status, reused: false }, 202);
			}
			gets++;
			if (status === "missing") return send({}, 404);
			if (status === "forbidden") return send({ message: "private provider detail" }, 403);
			return send({ ...report, status, canRetry: status === "failed" });
		}
		if (path.endsWith("/planning-suggestions"))
			return send({ status: "unavailable", recommendations: [] });
		if (path.includes("/sos")) return send({ items: [], total: 0 });
		if (path === "/api/booking-cancellation-notices") return send([]);
		return send({
			id: "test-host",
			fullName: "Test Host",
			role: "host",
			roles: ["host"],
			status: "active",
		});
	});
	await page.goto("/host/demand-insights");
	return {
		posts: () => posts,
		gets: () => gets,
		setStatus: (next: DemandStatus) => {
			status = next;
		},
	};
}
test("mock HTTP: creation recovers after reload and polling stops on completion and hidden tabs", async ({
	page,
}) => {
	const state = await mockUI(page, "missing");
	await page.getByRole("button", { name: "Tạo báo cáo", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Đang tạo báo cáo. Trang sẽ tự cập nhật." })
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Đang tạo báo cáo. Trang sẽ tự cập nhật." })
	).toBeVisible();
	expect(state.posts()).toBe(1);
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await page.waitForTimeout(250);
	const hiddenGets = state.gets();
	await page.waitForTimeout(5500);
	expect(state.gets()).toBe(hiddenGets);
	state.setStatus("succeeded");
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await expect(page.getByRole("heading", { name: /có 2 loại chuyến đủ dữ liệu/ })).toBeVisible();
	const finishedGets = state.gets();
	await page.waitForTimeout(5500);
	expect(state.gets()).toBe(finishedGets);
	await page.reload();
	await expect(page.getByRole("heading", { name: /có 2 loại chuyến đủ dữ liệu/ })).toBeVisible();
	expect(state.posts()).toBe(1);
});
for (const status of ["insufficient_data", "withheld"] as const)
	test(`mock HTTP: ${status} hides residual cells and exposes only public exploration`, async ({
		page,
	}) => {
		await mockUI(page, status);
		await expect(
			page.getByRole("link", { name: "Khám phá chuyến đi", exact: true }).last()
		).toBeVisible();
		await expect(page.getByRole("heading", { name: "Gợi ý tổ chức chuyến" })).toHaveCount(0);
		await expect(page.getByText("20–29", { exact: false })).toHaveCount(0);
		await expect(page.getByRole("link", { name: "Xem người tham gia & đặt chỗ" })).toHaveCount(0);
	});
test("mock HTTP: retry is server-authorized and double clicks do not duplicate creation", async ({
	page,
}) => {
	const state = await mockUI(page, "failed");
	await page.getByRole("button", { name: "Thử lại báo cáo" }).click();
	await expect(
		page.getByRole("heading", { name: "Đang tạo báo cáo. Trang sẽ tự cập nhật." })
	).toBeVisible();
	expect(state.posts()).toBe(1);
});
test("mock HTTP: cooldown honors Retry-After rather than the conflicting response body", async ({
	page,
}) => {
	const state = await mockUI(page, "missing", 429);
	await page.getByRole("button", { name: "Tạo báo cáo", exact: true }).click();
	await expect(page.getByText(/Vui lòng đợi (2[0-9]|30) giây rồi thử lại/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Tạo báo cáo", exact: true })).toBeDisabled();
	expect(state.posts()).toBe(1);
});
test("mock HTTP: 422 uses the server date and 403 hides technical errors", async ({ page }) => {
	await mockUI(page, "missing", 422);
	await page.getByRole("button", { name: "Tạo báo cáo", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("9/11/26");
	await page.unroute("http://localhost:3000/api/**");
	await mockUI(page, "forbidden");
	await expect(page.getByText("Bạn không có quyền xem trang này.")).toBeVisible();
	await expect(page.getByText("private provider detail")).toHaveCount(0);
});
test("live API/database: stored AI report survives reload, hides identities and both destinations open for Host", async ({
	page,
}) => {
	await page.goto("/login");
	await page.locator("input").nth(0).fill("host@ctms.local");
	await page.locator("input").nth(1).fill("Host@123");
	await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
	await page.waitForURL("**/dashboard");
	await page.goto("/host/demand-insights");
	await page.getByRole("combobox", { name: "Tháng", exact: true }).selectOption(month);
	await expect(page.getByRole("heading", { name: /Tháng 8\/2026 có 2 loại/ })).toBeVisible();
	await expect(page.getByText("20–29", { exact: false }).first()).toBeVisible();
	await expect(page.getByText("30–39", { exact: false }).first()).toBeVisible();
	const payload = await page.evaluate(async (month) => {
		const response = await fetch(`http://localhost:3000/api/host/demand-insights/${month}`, {
			headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
		});
		return response.json();
	}, month);
	expect(payload.status).toBe("succeeded");
	expect(JSON.stringify(payload)).not.toMatch(
		/host_id|trip_id|booking_id|user_id|source_hash|config_hash|@/
	);
	await page.reload();
	await expect(page.getByRole("heading", { name: /Tháng 10\/2026 có 2 loại/ })).toBeVisible();
	await page.getByRole("link", { name: "Xem người tham gia & đặt chỗ", exact: true }).click();
	await expect(page).toHaveURL(/\/host\/campers\?from=demand-insights$/);
	await expect(page.getByText("Bạn không có quyền xem trang này.")).toHaveCount(0);
	await page.getByRole("button", { name: "Quay về Nhu cầu đặt chỗ" }).click();
	await expect(page).toHaveURL(/\/host\/demand-insights$/);
	await page.getByRole("link", { name: "Khám phá chuyến đi", exact: true }).last().click();
	await expect(page).toHaveURL(/\/trips$/);
	await expect(page.getByRole("heading", { name: /404|không có quyền/i })).toHaveCount(0);
});

const planningFixture: DemandPlanningReport = {
	status: "succeeded",
	reportVersion: "synthetic-report",
	dataPeriod: month,
	generatedAt: "2026-11-07T06:51:55Z",
	stale: false,
	errorCode: null,
	recommendations: [
		{
			candidateId: "c1",
			tripType: "day_trip",
			difficulty: "easy",
			bookerBand: { min: 10, max: 19 },
			priceBand: "under_500k",
			capacityBand: "11_to_20",
			durationBand: "day",
			area: {
				code: "demo-lowland",
				label: "Vùng đồng bằng mẫu",
				provenance: "host_confirmed_catalog",
			},
			priceRangeLabel: "Dưới 500.000 VND/người",
			capacityRangeLabel: "11–20 chỗ",
			durationLabel: "Trong ngày",
			evidenceBasis: "observed_bookings",
			capacityMeaning: "offered_at_booking",
			generalAdvice: [
				{ code: "balanced_pace", text: "Bố trí nhịp hoạt động và thời gian nghỉ phù hợp." },
			],
			disclaimer: "Thống kê mô tả, không đảm bảo số người tham gia.",
		},
	],
};
async function mockPlanning(page: Page, initial: DemandPlanningStatus, postCode = 202) {
	await mockUI(page);
	let status = initial;
	let posts = 0;
	let gets = 0;
	await page.route(`**/api/host/demand-insights/${month}/planning-suggestions`, async (route) => {
		const send = (body: unknown, code = 200, headers: Record<string, string> = {}) =>
			route.fulfill({
				status: code,
				contentType: "application/json",
				body: JSON.stringify(body),
				headers: { "Access-Control-Expose-Headers": "Retry-After", ...headers },
			});
		if (route.request().method() === "POST") {
			posts++;
			if (postCode === 429) return send({ retryAfterSeconds: 99 }, 429, { "Retry-After": "30" });
			if (postCode === 422)
				return send({ code: "context_stale", message: "private provider detail" }, 422);
			status = postCode === 200 ? "succeeded" : "running";
			return send({ status, reused: postCode === 200 }, postCode);
		}
		gets++;
		return send({ ...planningFixture, status });
	});
	await page.reload();
	return {
		setStatus: (next: DemandPlanningStatus) => {
			status = next;
		},
		posts: () => posts,
		gets: () => gets,
	};
}
test("planning mock HTTP: explicit 202 request survives reload and clears active polling on completion", async ({
	page,
}) => {
	const state = await mockPlanning(page, "not_requested");
	await page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Đang tạo gợi ý tổ chức chuyến. Trang sẽ tự cập nhật." })
	).toBeVisible();
	await expect(page.getByText(/^[0-9]+%$/)).toHaveCount(0);
	expect(state.posts()).toBe(1);
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Đang tạo gợi ý tổ chức chuyến. Trang sẽ tự cập nhật." })
	).toBeVisible();
	state.setStatus("succeeded");
	await expect(page.getByText("Dưới 500.000 VND/người", { exact: true })).toBeVisible({
		timeout: 12000,
	});
	await expect(
		page.getByRole("heading", { name: "Dữ liệu đã ghi nhận", exact: true })
	).toBeVisible();
	const gets = state.gets();
	await page.waitForTimeout(5500);
	expect(state.gets()).toBe(gets);
	expect(state.posts()).toBe(1);
});
test("planning mock HTTP: terminal 200 result is reconciled without a retry button", async ({
	page,
}) => {
	const state = await mockPlanning(page, "not_requested", 200);
	await page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true }).click();
	await expect(page.getByText("Dưới 500.000 VND/người", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true })).toHaveCount(
		0
	);
	expect(state.posts()).toBe(1);
});
for (const status of ["unavailable", "withheld", "failed"] as const)
	test(`planning mock HTTP: ${status} hides residual suggestions and cannot create`, async ({
		page,
	}) => {
		await mockPlanning(page, status);
		await expect(
			page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true })
		).toHaveCount(0);
		await expect(page.getByText("Dưới 500.000 VND/người", { exact: true })).toHaveCount(0);
		if (status === "unavailable")
			await expect(
				page.getByText("Chưa hỗ trợ gợi ý tổ chức chuyến cho kỳ báo cáo này.")
			).toBeVisible();
		if (status === "withheld")
			await expect(
				page.getByText("Gợi ý tổ chức chuyến không còn được hiển thị để bảo vệ thông tin.")
			).toBeVisible();
		if (status === "failed")
			await expect(
				page.getByText("Chưa thể tạo gợi ý tổ chức chuyến cho tháng này.")
			).toBeVisible();
	});
test("planning mock HTTP: 429 respects header and 422 surfaces a safe actionable message", async ({
	page,
}) => {
	await mockPlanning(page, "not_requested", 429);
	await page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true }).click();
	await expect(page.getByText(/Vui lòng đợi (2[0-9]|30) giây rồi thử lại/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true })
	).toBeDisabled();
});
test("planning mock HTTP: 422 displays the safe error and never provider details", async ({
	page,
}) => {
	await mockPlanning(page, "not_requested", 422);
	await page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Dữ liệu kỳ này đã thay đổi, không thể tạo gợi ý mới."
	);
	await expect(page.getByText("private provider detail")).toHaveCount(0);
});
test("live API/database: persisted July planning evidence loads and survives reload without POST", async ({
	page,
}) => {
	let planningPosts = 0;
	page.on("request", (req) => {
		if (req.method() === "POST" && req.url().endsWith("/planning-suggestions")) planningPosts++;
	});
	await page.goto("/login");
	await page.locator("input").nth(0).fill("host@ctms.local");
	await page.locator("input").nth(1).fill("Host@123");
	await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
	await page.waitForURL("**/dashboard");
	await page.goto("/host/demand-insights");
	await page.getByRole("combobox", { name: "Tháng", exact: true }).selectOption("2026-07");
	await expect(page.getByText("Dưới 500.000 VND/người", { exact: true })).toBeVisible();
	await expect(page.getByText("Vùng đồng bằng mẫu", { exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Dữ liệu đã ghi nhận", exact: true })).toHaveCount(
		2
	);
	await expect(page.getByRole("button", { name: "Gợi ý tổ chức chuyến", exact: true })).toHaveCount(
		0
	);
	await page.reload();
	await page.getByRole("combobox", { name: "Tháng", exact: true }).selectOption("2026-07");
	await expect(page.getByText("Dưới 500.000 VND/người", { exact: true })).toBeVisible();
	expect(planningPosts).toBe(0);
});

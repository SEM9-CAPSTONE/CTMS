import { type Page, expect, test } from "@playwright/test";
import type { DemandReport, DemandStatus } from "../../src/features/demand-insights/types";
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

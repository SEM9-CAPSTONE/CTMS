import { type Page, expect, test } from "@playwright/test";
import {
	batch,
	batchFixture,
	insightFixture,
	tripId,
} from "../../src/features/review-analysis/review-analysis.test-fixtures";
async function mockUI(page: Page, role = "host", mode = "success") {
	let created = false;
	let completed = false;
	let polls = 0;
	let posts = 0;
	// Synthetic HTTP sessions must not reach the live Socket.IO authentication edge.
	await page.route("**/socket.io/**", (route) => route.abort());
	await page.routeWebSocket("**/socket.io/**", (socket) => socket.close());
	await page.addInitScript(
		({ role }) => {
			localStorage.setItem("accessToken", "ctms-412-synthetic-test-token");
			localStorage.setItem(
				"authUser",
				JSON.stringify({
					id: "test-user",
					role,
					roles: [role],
					status: "active",
					createdAt: "2026-11-05T00:00:00Z",
				})
			);
		},
		{ role }
	);
	await page.route("http://localhost:3000/api/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		const send = (data: unknown, status = 200) =>
			route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
		if (path === "/api/booking-cancellation-notices") return send([]);
		if (path === "/api/review-analysis/trips")
			return send({
				items: [{ id: tripId, title: "Sơn Trà", status: "completed" }],
				pagination: { page: 1, total: 1, totalPages: 1 },
			});
		if (path.endsWith("/review-analyses")) {
			if (mode === "forbidden") return send({ message: "Private provider body" }, 403);
			const data = insightFixture();
			if (created) data.latestBatch = { ...batch, status: completed ? "succeeded" : "running" };
			const sentiment = new URL(route.request().url()).searchParams.get("sentiment");
			if (sentiment === "neutral") {
				data.items = [{ ...data.items[0], sentiment: "neutral", summary: "Nhận xét trung lập" }];
				data.pagination = { page: 1, limit: 6, total: 1, totalPages: 1 };
			}
			return send(data);
		}
		if (path.endsWith("/review-analysis-batches") && route.request().method() === "POST") {
			posts++;
			if (mode === "limited") return send({ retryAfterSeconds: 8 }, 429);
			created = true;
			return send({ batch, reused: false, remainingCount: 1, hasMore: true }, 202);
		}
		if (path.includes("/review-analysis-batches/")) {
			polls++;
			if (polls > 1) completed = true;
			return send(batchFixture(completed ? "succeeded" : "running"));
		}
		if (path.includes("/source/"))
			return send({
				reviewId: "review",
				revision: 2,
				currentRevision: 2,
				rating: 4,
				comment: "Đánh giá gốc <b>không phải HTML</b>",
				createdAt: "2026-11-05T00:00:00Z",
			});
		if (path.includes("/sos")) return send({ items: [], total: 0 });
		return send({
			id: "test-user",
			fullName: "Test Host",
			email: "test@example.test",
			role,
			roles: [role],
			status: "active",
		});
	});
	await page.goto(`/${role}/review-analysis?trip=${tripId}`);
	return { posts: () => posts, polls: () => polls };
}
test("mock API: filters complete result set, displays source as text and keeps totals", async ({
	page,
}) => {
	await mockUI(page);
	await expect(page.getByText("Cảnh đẹp. <img src=x onerror=alert(1)>")).toBeVisible();
	await expect(page.locator("article img")).toHaveCount(0);
	await page.getByRole("button", { name: "Trung lập 1", exact: true }).click();
	await expect(page.getByText("Nhận xét trung lập", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: /8\s*\/\s*9 đánh giá đủ điều kiện/ })
	).toBeVisible();
	await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
	await page.getByRole("button", { name: "Xem đánh giá gốc · phiên bản 2", exact: true }).click();
	await expect(
		page.getByText("Đánh giá gốc <b>không phải HTML</b>", { exact: true })
	).toBeVisible();
});
test("mock API: 202 polls to completion, stops, and restores persisted batch after reload", async ({
	page,
}) => {
	const state = await mockUI(page);
	await page.getByRole("button", { name: "Phân tích đánh giá", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Đang xử lý lượt phân tích" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Lượt phân tích gần nhất" })).toBeVisible({
		timeout: 10000,
	});
	const polls = state.polls();
	await page.waitForTimeout(2500);
	expect(state.polls()).toBe(polls);
	expect(state.posts()).toBe(1);
	await page.reload();
	await expect(page.getByRole("heading", { name: "Lượt phân tích gần nhất" })).toBeVisible();
	expect(state.posts()).toBe(1);
});
test("mock API: 429 shows countdown and disables repeat submission", async ({ page }) => {
	const state = await mockUI(page, "host", "limited");
	await page.getByRole("button", { name: "Phân tích đánh giá", exact: true }).click();
	await expect(page.getByRole("button", { name: /Chờ [1-8] giây/ })).toBeDisabled();
	expect(state.posts()).toBe(1);
});
test("mock API: Host cannot display protected data for another Host", async ({ page }) => {
	await mockUI(page, "host", "forbidden");
	await expect(page.getByRole("heading", { name: "Không thể mở phân tích" })).toBeVisible();
	await expect(page.locator("article")).toHaveCount(0);
	await expect(page.getByText("Private provider body")).toHaveCount(0);
});
test("mock API: Admin route loads and small screens keep the controls accessible", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await mockUI(page, "admin");
	await expect(page.getByRole("heading", { name: "Phân tích đánh giá" })).toBeVisible();
	await expect(page.getByRole("combobox")).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
test("live API/database: Host reads stored Gemini analysis and source after reload without new provider calls", async ({
	page,
}) => {
	await page.goto("/login");
	const inputs = page.locator("input");
	await inputs.nth(0).fill("host@ctms.local");
	await inputs.nth(1).fill("Host@123");
	await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
	await page.waitForURL("**/dashboard");
	const path = "/host/review-analysis?trip=d4120000-0000-4000-8004-000000000002";
	await page.goto(path);
	await expect(
		page.getByRole("heading", { name: /32\s*\/\s*32 đánh giá đủ điều kiện/ })
	).toBeVisible({ timeout: 15000 });
	await page.getByRole("button", { name: "Xem chi tiết", exact: true }).first().click();
	await page
		.getByRole("button", { name: /Xem đánh giá gốc/ })
		.first()
		.click();
	await expect(page.getByText(/Đánh giá của người tham gia/)).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: /32\s*\/\s*32 đánh giá đủ điều kiện/ })
	).toBeVisible();
});

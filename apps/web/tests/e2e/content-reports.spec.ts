import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

interface Fixtures {
	adminEmail: string;
	camperEmail: string;
	password: string;
	reporterId: string;
	targetId: string;
	reportIds: string[];
}
interface Session {
	accessToken: string;
	refreshToken: string;
	user: { id: string; role: string; roles: string[] };
}
const api = "http://localhost:3000/api";
const runId = randomUUID();
let fixtures: Fixtures;
function fixture(action: "seed" | "clean"): string {
	return execFileSync(
		process.execPath,
		["node_modules/ts-node/dist/bin.js", "src/seeds/content-reports-e2e.ts", action, runId],
		{ cwd: path.resolve(process.cwd(), "../../services/api"), encoding: "utf8" }
	);
}
async function login(request: APIRequestContext, page: Page, email: string): Promise<Session> {
	const response = await request.post(`${api}/auth/login`, {
		data: { identifier: email, password: fixtures.password },
	});
	expect(response.ok()).toBeTruthy();
	const session = (await response.json()) as Session;
	await page.addInitScript((auth) => {
		localStorage.setItem("accessToken", auth.accessToken);
		localStorage.setItem("refreshToken", auth.refreshToken);
		localStorage.setItem("authUser", JSON.stringify(auth.user));
	}, session);
	return session;
}
test.describe("Content Reports (real backend and PostgreSQL)", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(90_000);
	test.beforeAll(() => {
		fixtures = JSON.parse(fixture("seed")) as Fixtures;
	});
	test.afterAll(() => {
		fixture("clean");
	});
	test("Admin navigates, reads queue/details and transitions with backend-confirmed state", async ({
		page,
		request,
	}, testInfo) => {
		const session = await login(request, page, fixtures.adminEmail);
		await page.goto("/admin/users");
		await page.getByRole("button", { name: "Báo cáo nội dung", exact: true }).click();
		await expect(page).toHaveURL(/\/admin\/content-reports$/);
		const id = fixtures.reportIds[0];
		const row = page
			.getByRole("row")
			.filter({ has: page.getByRole("button", { name: `Xem báo cáo ${id}` }) });
		for (const text of [
			"E2E Content Reports camper",
			fixtures.reporterId,
			"review",
			fixtures.targetId,
			`E2E Content Reports ${runId}`,
			"Chờ xử lý",
		])
			await expect(row.getByText(text, { exact: true })).toBeVisible();
		await row.getByRole("button").click();
		const panel = page.getByRole("region", { name: "Chi tiết báo cáo" });
		for (const name of ["Chuyển sang xem xét", "Đánh dấu đã xử lý", "Từ chối báo cáo"])
			await expect(panel.getByRole("button", { name })).toBeVisible();
		await page.screenshot({
			path: testInfo.outputPath("content-reports-detail.png"),
			fullPage: true,
		});
		const patch = page.waitForResponse(
			(response) =>
				response.url().endsWith(`/${id}/status`) && response.request().method() === "PATCH"
		);
		await panel.getByRole("button", { name: "Đánh dấu đã xử lý" }).click();
		expect((await patch).status()).toBe(200);
		await expect(panel.getByText("Đã xử lý", { exact: true })).toBeVisible();
		await expect(row.getByText("Đã xử lý", { exact: true })).toBeVisible();
		await expect(panel.getByRole("button", { name: "Chuyển sang xem xét" })).toHaveCount(0);
		const detail = await request.get(`${api}/content-reports/${id}`, {
			headers: { Authorization: `Bearer ${session.accessToken}` },
		});
		expect((await detail.json()).status).toBe("actioned");
	});
	test("stale report produces real 409 and refreshes without retrying mutation", async ({
		page,
		request,
	}) => {
		const session = await login(request, page, fixtures.adminEmail);
		const headers = { Authorization: `Bearer ${session.accessToken}` };
		const id = fixtures.reportIds[1];
		await page.goto("/admin/content-reports");
		await page.getByRole("button", { name: `Xem báo cáo ${id}` }).click();
		const panel = page.getByRole("region", { name: "Chi tiết báo cáo" });
		await expect(panel.getByRole("button", { name: "Chuyển sang xem xét" })).toBeVisible();
		const concurrent = await request.patch(`${api}/content-reports/${id}/status`, {
			headers,
			data: { expectedStatus: "pending", status: "rejected" },
		});
		expect(concurrent.status()).toBe(200);
		let mutations = 0;
		page.on("request", (req) => {
			if (req.method() === "PATCH") mutations++;
		});
		const conflict = page.waitForResponse((response) => response.url().endsWith(`/${id}/status`));
		await panel.getByRole("button", { name: "Chuyển sang xem xét" }).click();
		expect((await conflict).status()).toBe(409);
		await expect(panel.getByRole("alert")).toContainText("Trạng thái báo cáo đã thay đổi");
		await expect(panel.getByText("Đã từ chối", { exact: true })).toBeVisible();
		await expect(
			page
				.getByRole("row")
				.filter({ has: page.getByRole("button", { name: `Xem báo cáo ${id}` }) })
				.getByText("Đã từ chối", { exact: true })
		).toBeVisible();
		await expect(panel.getByRole("button", { name: "Chuyển sang xem xét" })).toHaveCount(0);
		expect(mutations).toBe(1);
	});
	test("non-Admin is blocked in UI and by real queue/detail/mutation authorization", async ({
		page,
		request,
	}) => {
		const session = await login(request, page, fixtures.camperEmail);
		await page.goto("/admin/content-reports");
		await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
		expect(await page.getByRole("button", { name: "Chuyển sang xem xét" }).count()).toBe(0);
		const headers = { Authorization: `Bearer ${session.accessToken}` };
		for (const endpoint of ["content-reports", `content-reports/${fixtures.reportIds[0]}`])
			expect((await request.get(`${api}/${endpoint}`, { headers })).status()).toBe(403);
		expect(
			(
				await request.patch(`${api}/content-reports/${fixtures.reportIds[0]}/status`, {
					headers,
					data: { expectedStatus: "pending", status: "reviewing" },
				})
			).status()
		).toBe(403);
		expect((await request.get(`${api}/content-reports`)).status()).toBe(401);
	});
	for (const [index, status, label, finalLabel] of [
		[2, "actioned", "Đánh dấu đã xử lý", "Đã xử lý"],
		[3, "rejected", "Từ chối báo cáo", "Đã từ chối"],
	] as const) {
		test(`Admin completes pending -> reviewing -> ${status}`, async ({ page, request }) => {
			const session = await login(request, page, fixtures.adminEmail);
			const id = fixtures.reportIds[index];
			await page.goto("/admin/content-reports");
			await page.getByRole("button", { name: `Xem báo cáo ${id}` }).click();
			const panel = page.getByRole("region", { name: "Chi tiết báo cáo" });
			await panel.getByRole("button", { name: "Chuyển sang xem xét" }).click();
			await expect(panel.getByText("Đang xem xét", { exact: true })).toBeVisible();
			await expect(panel.getByRole("button", { name: "Chuyển sang xem xét" })).toHaveCount(0);
			await expect(panel.getByRole("button", { name: "Đánh dấu đã xử lý" })).toBeEnabled();
			await expect(panel.getByRole("button", { name: "Từ chối báo cáo" })).toBeEnabled();
			const patch = page.waitForResponse(
				(response) =>
					response.url().endsWith(`/${id}/status`) && response.request().method() === "PATCH"
			);
			await panel.getByRole("button", { name: label }).click();
			const response = await patch;
			expect(response.status()).toBe(200);
			expect(response.request().postDataJSON()).toEqual({ expectedStatus: "reviewing", status });
			await expect(panel.getByText(finalLabel, { exact: true })).toBeVisible();
			for (const action of ["Chuyển sang xem xét", "Đánh dấu đã xử lý", "Từ chối báo cáo"])
				await expect(panel.getByRole("button", { name: action })).toHaveCount(0);
			await expect(
				page
					.getByRole("row")
					.filter({ has: page.getByRole("button", { name: `Xem báo cáo ${id}` }) })
					.getByText(finalLabel, { exact: true })
			).toBeVisible();
			const detail = await request.get(`${api}/content-reports/${id}`, {
				headers: { Authorization: `Bearer ${session.accessToken}` },
			});
			expect((await detail.json()).status).toBe(status);
		});
	}
});

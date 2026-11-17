import { type Page, expect, test } from "@playwright/test";
import type { InvestigationCommand } from "../../src/features/admin-ai-investigations/ai-investigations.types";
import { investigationFixture, investigationList } from "../fixtures/ai-investigations";

async function setup(page: Page, role: "admin" | "camper") {
	const actor = {
		id: `${role}-account`,
		fullName: "Nguyễn Minh An",
		email: `${role}@ctms.local`,
		role,
		roles: [role],
		status: "active",
		createdAt: investigationFixture.createdAt,
	};
	let detail = { ...investigationFixture };
	const commands: InvestigationCommand[] = [];
	let investigationReads = 0;
	await page.addInitScript((user) => {
		localStorage.setItem("accessToken", "investigation-browser-fixture");
		localStorage.setItem("authUser", JSON.stringify(user));
	}, actor);
	await page.routeWebSocket("**/socket.io/**", (socket) => socket.close());
	await page.route("**/api/**", async (route) => {
		const { pathname } = new URL(route.request().url());
		const headers = {
			"access-control-allow-origin": "*",
			"access-control-allow-headers": "authorization, content-type",
			"access-control-allow-methods": "GET, PATCH, OPTIONS",
		};
		const send = (json: unknown) => route.fulfill({ json, headers });
		if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
		if (pathname === "/api/content-reports") {
			return send({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
		}
		if (pathname === "/api/admin/moderation/counts") {
			return send({ trips: 0, trekkingRoutes: 0, porterVerifications: 0, contentReports: 0 });
		}
		if (pathname === "/api/admin/ai-investigations") {
			investigationReads++;
			return send(investigationList(detail));
		}
		if (pathname === `/api/admin/ai-investigations/${detail.id}`) {
			if (route.request().method() === "PATCH") {
				const command = route.request().postDataJSON() as InvestigationCommand;
				commands.push(command);
				if (command.action === "START_REVIEW") {
					detail = {
						...detail,
						version: 2,
						reviewStatus: "reviewing",
						reviewerName: actor.fullName,
					};
				} else if (command.action === "HANDOFF") {
					detail = { ...detail, version: 3, technicalStatus: "HANDED_OFF" };
				} else {
					detail = {
						...detail,
						version: 4,
						reviewStatus: "actioned",
						technicalStatus: command.disposition,
						resolutionNote: command.resolutionNote,
						closedAt: detail.createdAt,
					};
				}
			}
			return send(detail);
		}
		return send(actor);
	});
	return { commands, reads: () => investigationReads };
}

test("Admin opens the queue from the existing sidebar and closes an investigation with documented verification", async ({
	page,
}) => {
	const api = await setup(page, "admin");
	await page.goto("/admin/content-reports");
	const sidebar = page.getByRole("navigation", { name: "Điều hướng quản trị" });
	await expect(sidebar).toHaveCount(1);
	await sidebar.getByRole("link", { name: "Điều tra phản hồi AI" }).click();
	await expect(page).toHaveURL(/\/admin\/ai-investigations$/);
	await expect(sidebar.getByRole("link", { name: "Điều tra phản hồi AI" })).toHaveAttribute(
		"aria-current",
		"page"
	);
	await page.getByRole("button", { name: /^Xem báo cáo nguy hiểm/ }).click();
	const dialog = page.getByRole("dialog");
	await expect(
		dialog.getByText(investigationFixture.evidence?.answer ?? "", { exact: true })
	).toBeVisible();
	await dialog.getByRole("button", { name: "Tiếp nhận xem xét" }).click();
	await dialog.getByRole("button", { name: "Ghi nhận bàn giao" }).click();
	await dialog.getByLabel("Mã hoặc đường dẫn bàn giao").fill("CTMS-343");
	await dialog.getByLabel("Nội dung cần xác minh").fill("Đối chiếu tài liệu đã công bố.");
	await dialog.getByRole("button", { name: "Lưu bàn giao" }).click();
	await expect(dialog.getByText("Đã ghi nhận bàn giao")).toBeVisible();
	await expect(dialog.getByText("Đang xem xét")).toBeVisible();
	await dialog.getByRole("button", { name: "Ghi kết luận" }).click();
	await dialog.getByLabel("Kết luận", { exact: true }).selectOption("VERIFIED_FIX");
	await dialog
		.getByLabel("Phạm vi và kết quả xác minh")
		.fill("Đã đối chiếu nguồn và tái hiện lượt trả lời.");
	await dialog.getByLabel("Ghi chú kết luận").fill("Bản sửa đã bổ sung bước đối chiếu.");
	await dialog.getByRole("button", { name: "Lưu kết luận và đóng hồ sơ" }).click();
	await expect(dialog.getByText("Đã xử lý", { exact: true })).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Ghi kết luận" })).toHaveCount(0);
	expect(api.commands.map(({ action, version }) => [action, version])).toEqual([
		["START_REVIEW", 1],
		["HANDOFF", 2],
		["RESOLVE", 3],
	]);
});

test("Camper cannot open the Admin route", async ({ page }) => {
	const api = await setup(page, "camper");
	await page.goto("/admin/ai-investigations");
	await expect(page.getByRole("heading", { name: "Điều tra phản hồi AI" })).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: /không có quyền|truy cập bị từ chối/i })
	).toBeVisible();
	expect(api.reads()).toBe(0);
});

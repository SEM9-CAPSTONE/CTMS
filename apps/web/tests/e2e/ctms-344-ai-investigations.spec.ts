import { type Page, expect, test } from "@playwright/test";
import type { InvestigationCommand } from "../../src/features/admin-ai-investigations/ai-investigations.types";
import {
	investigationFixture,
	investigationList,
	notUsefulInvestigationFixture,
} from "../fixtures/ai-investigations";

const title = "Phân tích & xử lý phản hồi AI";

async function setup(page: Page, role: "admin" | "camper", empty = false) {
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
	const queries: URLSearchParams[] = [];
	const opened: string[] = [];
	let investigationReads = 0;
	await page.addInitScript((user) => {
		localStorage.setItem("accessToken", "investigation-browser-fixture");
		localStorage.setItem("authUser", JSON.stringify(user));
	}, actor);
	await page.routeWebSocket("**/socket.io/**", (socket) => socket.close());
	// Keep Vite modules under /src/core/api/ outside the API mock.
	await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
		const { pathname, searchParams } = new URL(route.request().url());
		const headers = {
			"access-control-allow-origin": "*",
			"access-control-allow-headers": "authorization, content-type",
			"access-control-allow-methods": "GET, PATCH, OPTIONS",
		};
		const send = (json: unknown, status = 200) => route.fulfill({ json, headers, status });
		if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
		if (pathname === "/api/profiles/me") return send(actor);
		if (pathname === "/api/booking-cancellation-notices") return send([]);
		if (pathname === "/api/me/weather-decision-alerts") {
			return send({ items: [], unreadCount: 0 });
		}
		if (pathname === "/api/content-reports") {
			return send({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
		}
		if (pathname === "/api/admin/moderation/counts") {
			return send({ trips: 0, trekkingRoutes: 0, porterVerifications: 0, contentReports: 0 });
		}
		if (pathname === "/api/admin/ai-investigations") {
			investigationReads++;
			queries.push(searchParams);
			const list = investigationList(detail);
			if (empty)
				return send({
					...list,
					items: [],
					pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
					summary: { totalCases: 0, unsafeCases: 0, notUsefulCases: 0, resolvedCases: 0 },
				});
			const onlyNotUseful = searchParams.get("scope") === "NOT_USEFUL";
			const onlyUnsafe = searchParams.get("scope") === "UNSAFE";
			const page = Number(searchParams.get("page") ?? 1);
			const q = searchParams.get("q");
			const otherItems = investigationList(notUsefulInvestigationFixture).items;
			return send({
				...list,
				summary: {
					totalCases: 22,
					unsafeCases: 1,
					notUsefulCases: 21,
					resolvedCases: detail.closedAt ? 1 : 0,
				},
				items: q
					? []
					: onlyNotUseful || page === 2
						? otherItems
						: onlyUnsafe
							? list.items
							: [...list.items, ...otherItems],
				pagination: q
					? { page, limit: 20, total: 0, totalPages: 0 }
					: onlyNotUseful
						? { page, limit: 20, total: 21, totalPages: 2 }
						: list.pagination,
			});
		}
		if (pathname === `/api/admin/ai-investigations/${notUsefulInvestigationFixture.id}`) {
			opened.push(notUsefulInvestigationFixture.id);
			return send(notUsefulInvestigationFixture);
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
			} else opened.push(detail.id);
			return send(detail);
		}
		return send({ message: `No mock for ${pathname}` }, 404);
	});
	return { commands, queries, opened, reads: () => investigationReads };
}

test("Admin opens the queue from the existing sidebar and closes an investigation with documented verification", async ({
	page,
}) => {
	const api = await setup(page, "admin");
	await page.goto("/admin/content-reports");
	const sidebar = page.getByRole("navigation", { name: "Điều hướng quản trị" });
	await expect(sidebar).toHaveCount(1);
	await sidebar.getByRole("link", { name: title }).click();
	await expect(page).toHaveURL(/\/admin\/ai-investigations$/);
	await expect(sidebar.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
	await expect(page.getByRole("heading", { name: title })).toBeVisible();
	await expect(
		page.getByText(
			"Theo dõi kết quả phân tích, xem xét các phản hồi về câu trả lời AI và ghi nhận kết quả xử lý."
		)
	).toHaveCount(0);
	await page.getByRole("button", { name: /^Báo cáo nguy hiểm/ }).click();
	const dialog = page.getByRole("region", { name: "Chi tiết hồ sơ" });
	await expect(
		dialog.getByText(investigationFixture.evidence?.answer ?? "", { exact: true })
	).toBeVisible();
	await dialog.getByRole("button", { name: "Bắt đầu xem xét" }).click();
	await dialog.getByRole("button", { name: "Bàn giao kỹ thuật" }).click();
	await dialog.getByLabel("Mã hoặc đường dẫn bàn giao").fill("CTMS-343");
	await dialog.getByLabel("Nội dung cần xác minh").fill("Đối chiếu tài liệu đã công bố.");
	await dialog.getByRole("button", { name: "Lưu bàn giao" }).click();
	await expect(dialog.getByText("Đã bàn giao", { exact: true })).toBeVisible();
	await expect(dialog.getByText("Đang xem xét")).toBeVisible();
	await dialog.getByRole("button", { name: "Xác nhận kết quả xử lý" }).click();
	await dialog.getByLabel("Kết luận", { exact: true }).selectOption("VERIFIED_FIX");
	await dialog
		.getByLabel("Phạm vi và kết quả xác minh")
		.fill("Đã đối chiếu nguồn và tái hiện lượt trả lời.");
	await dialog.getByLabel("Ghi chú kết luận").fill("Bản sửa đã bổ sung bước đối chiếu.");
	await dialog.getByRole("button", { name: "Lưu kết luận và đóng hồ sơ" }).click();
	await expect(dialog.getByText("Đã xử lý", { exact: true })).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Xác nhận kết quả xử lý" })).toHaveCount(0);
	expect(api.commands.map(({ action, version }) => [action, version])).toEqual([
		["START_REVIEW", 1],
		["HANDOFF", 2],
		["RESOLVE", 3],
	]);
});

test("Admin selects rows beside the list and filters the full queue by category", async ({
	page,
}) => {
	const api = await setup(page, "admin");
	await page.goto("/admin/ai-investigations");
	const table = page.getByRole("table", { name: "Danh sách hồ sơ điều tra" });
	await expect(table.getByRole("columnheader", { name: "Thao tác" })).toHaveCount(0);
	await expect(table.getByRole("button", { name: /xem hồ sơ/i })).toHaveCount(0);
	const unsafe = table.getByRole("button", { name: /^Báo cáo nguy hiểm/ });
	const notUseful = table.getByRole("button", { name: /^Phản hồi chưa hữu ích/ });
	const question = table.getByRole("cell", {
		name: investigationFixture.evidence?.question ?? "",
		exact: true,
	});
	await expect(question).toBeVisible();
	expect(api.opened).toEqual([]);
	const cell = await question.boundingBox();
	if (!cell) throw new Error("Expected a visible question cell");
	await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height / 2);
	const panel = page.getByRole("region", { name: "Chi tiết hồ sơ" });
	await expect(panel.getByText(investigationFixture.evidence?.answer ?? "")).toBeVisible();
	await expect(table).toBeVisible();
	const [left, right] = await Promise.all([table.boundingBox(), panel.boundingBox()]);
	if (!left || !right) throw new Error("Expected both investigation columns");
	expect(right.x).toBeGreaterThan(left.x + left.width);
	await expect(unsafe).toHaveAttribute("aria-expanded", "true");
	const panelElement = await panel.elementHandle();
	await notUseful.click();
	await expect(panel.getByText(notUsefulInvestigationFixture.evidence?.answer ?? "")).toBeVisible();
	expect(await panel.evaluate((element, original) => element === original, panelElement)).toBe(
		true
	);
	await expect(panel.getByText("Chờ xem xét", { exact: true })).toHaveCount(0);
	await expect(panel.getByText("Phân tích thất bại", { exact: true })).toBeVisible();
	await expect(panel.getByText("Đã bàn giao", { exact: true })).toBeVisible();
	await expect(notUseful).toHaveAttribute("aria-expanded", "true");
	await panel.getByRole("button", { name: "Đóng chi tiết hồ sơ" }).click();
	await expect(panel).toHaveCount(0);
	await expect(notUseful).toBeFocused();
	expect(api.commands).toEqual([]);
	expect(api.opened).toEqual([investigationFixture.id, notUsefulInvestigationFixture.id]);
	const tab = page.getByRole("tab", { name: "Chưa hữu ích" });
	await tab.click();
	await expect(tab).toHaveAttribute("aria-selected", "true");
	await expect(unsafe).toHaveCount(0);
	await expect(page.getByLabel("Trạng thái xem xét")).toHaveCount(0);
	await page.getByRole("button", { name: "Tiếp theo" }).click();
	await expect(page.getByText("Trang 2 / 2")).toBeVisible();
	expect(api.queries.at(-1)?.get("scope")).toBe("NOT_USEFUL");
	expect(api.queries.at(-1)?.get("page")).toBe("2");
	const search = page.getByLabel("Tìm theo câu hỏi hoặc câu trả lời");
	await search.fill("đường rừng");
	await search.press("Enter");
	await expect(page.getByText("Không có hồ sơ phù hợp với bộ lọc.")).toBeVisible();
	await expect(page.getByLabel("Tổng quan hồ sơ phản hồi").getByText("22")).toBeVisible();
	expect(api.queries.at(-1)?.get("q")).toBe("đường rừng");
	expect(api.queries.at(-1)?.get("page")).toBe("1");
});

test("An empty dashboard shows all four server totals, search, and the empty table", async ({
	page,
}) => {
	await setup(page, "admin", true);
	await page.goto("/admin/ai-investigations");
	const summary = page.getByLabel("Tổng quan hồ sơ phản hồi");
	await expect(summary.getByText("0", { exact: true })).toHaveCount(4);
	await expect(page.getByLabel("Tìm theo câu hỏi hoặc câu trả lời")).toBeVisible();
	const table = page.getByRole("table", { name: "Danh sách hồ sơ điều tra" });
	await expect(table.getByText("Chưa có hồ sơ phản hồi.")).toBeVisible();
	await expect(page.getByRole("region", { name: "Chi tiết hồ sơ" })).toHaveCount(0);
});

test("A narrow viewport uses a full-width detail view and restores keyboard focus", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await setup(page, "admin");
	await page.goto("/admin/ai-investigations");
	const tab = page.getByRole("tab", { name: "Tất cả hồ sơ" });
	await tab.focus();
	await tab.press("ArrowRight");
	await expect(page.getByRole("tab", { name: "Báo cáo nguy hiểm" })).toBeFocused();
	const row = page.getByRole("button", { name: /^Báo cáo nguy hiểm/ });
	await row.focus();
	await row.press("Enter");
	const panel = page.getByRole("region", { name: "Chi tiết hồ sơ" });
	await expect(panel.getByRole("heading", { name: "Chi tiết hồ sơ" })).toBeFocused();
	await expect(page.getByRole("table", { name: "Danh sách hồ sơ điều tra" })).toBeHidden();
	await expect(page.getByRole("button", { name: "Mở menu" })).toBeVisible();
	expect((await panel.boundingBox())?.width).toBeGreaterThan(340);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
	await panel.getByRole("button", { name: "Đóng chi tiết hồ sơ" }).press("Enter");
	await expect(panel).toHaveCount(0);
	await expect(row).toBeFocused();
});

test("Camper cannot open the Admin route", async ({ page }) => {
	const api = await setup(page, "camper");
	await page.goto("/admin/ai-investigations");
	await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: /không có quyền|truy cập bị từ chối/i })
	).toBeVisible();
	expect(api.reads()).toBe(0);
});

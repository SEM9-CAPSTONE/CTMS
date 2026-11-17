import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	investigationFixture,
	investigationList,
	notUsefulInvestigationFixture,
} from "../../../tests/fixtures/ai-investigations";
import { HttpError } from "../../core/api";
import { AppRoutes } from "../../routes/AppRoutes";
import { toast } from "../../shared/components";
import { getStoredAuthUser, setAccessToken, setStoredAuthUser } from "../auth/utils/tokenStorage";
import { AdminAiInvestigationsPage } from "./AdminAiInvestigationsPage";
import { aiInvestigationsService } from "./ai-investigations.service";
import type { InvestigationDetail } from "./ai-investigations.types";

vi.mock("./ai-investigations.service", async (importOriginal) => ({
	...(await importOriginal<typeof import("./ai-investigations.service")>()),
	aiInvestigationsService: { list: vi.fn(), detail: vi.fn(), update: vi.fn() },
}));
vi.mock("../admin-layout/services/admin-moderation.service", () => ({
	adminModerationService: {
		getCounts: async () => ({
			trips: 0,
			trekkingRoutes: 0,
			porterVerifications: 0,
			contentReports: 0,
		}),
	},
}));
vi.mock("../camper-profile/services/camper-profile.service", () => ({
	camperProfileService: { getProfile: async () => null },
}));
vi.mock("../auth/services/auth.service", () => ({
	authService: { validateSession: async () => undefined },
}));

function displayPage(page: ReactElement = <AdminAiInvestigationsPage />) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
	return userEvent.setup();
}

async function displayCase(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("button", { name: /^Báo cáo nguy hiểm/ }));
	const panel = within(await screen.findByRole("region", { name: "Chi tiết hồ sơ" }));
	await panel.findByRole("heading", { name: "Kết quả phân tích AI" });
	return panel;
}

const httpError = (status: number) => new HttpError("Raw upstream failure", status, {});

describe("Admin AI investigation", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		localStorage.clear();
		window.history.replaceState({}, "", "/");
		setStoredAuthUser({
			id: "admin-user",
			role: "admin",
			status: "active",
			fullName: "Nguyễn Minh An",
			email: "admin@ctms.local",
			phone: null,
			createdAt: investigationFixture.createdAt,
		});
		vi.mocked(aiInvestigationsService.list).mockResolvedValue(investigationList());
		vi.mocked(aiInvestigationsService.detail).mockResolvedValue(investigationFixture);
		vi.mocked(aiInvestigationsService.update).mockResolvedValue(undefined);
	});

	it("mounts the investigation page at the Admin route", async () => {
		setAccessToken("investigation-route-fixture");
		window.history.replaceState({}, "", "/admin/ai-investigations");
		displayPage(<AppRoutes />);
		expect(
			await screen.findByRole("heading", { name: "Phân tích & xử lý phản hồi AI" })
		).toBeVisible();
		expect(
			screen.queryByText(
				"Theo dõi kết quả phân tích, xem xét các phản hồi về câu trả lời AI và ghi nhận kết quả xử lý."
			)
		).not.toBeInTheDocument();
		expect(await screen.findByRole("table", { name: "Danh sách hồ sơ điều tra" })).toBeVisible();
	});

	it("blocks Camper on direct navigation and makes no investigation request", async () => {
		const user = getStoredAuthUser();
		if (!user) throw new Error("Missing auth fixture");
		setStoredAuthUser({ ...user, role: "camper", roles: ["camper"] });
		setAccessToken("investigation-route-fixture");
		window.history.replaceState({}, "", "/admin/ai-investigations");
		displayPage(<AppRoutes />);
		expect(await screen.findByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
		expect(aiInvestigationsService.list).not.toHaveBeenCalled();
	});

	it("keeps server totals visible when a search resets pagination and returns no matches", async () => {
		const list = investigationList();
		vi.mocked(aiInvestigationsService.list).mockImplementation(async ({ page, q }) => ({
			...list,
			items: q ? [] : list.items,
			summary: { totalCases: 24, unsafeCases: 15, notUsefulCases: 9, resolvedCases: 6 },
			pagination: { page, limit: 20, total: q ? 0 : 24, totalPages: q ? 0 : 2 },
		}));
		const user = displayPage();
		const overview = within(screen.getByLabelText("Tổng quan hồ sơ phản hồi"));
		expect(await overview.findByText("24", { exact: true })).toBeVisible();
		await user.click(await screen.findByRole("button", { name: "Tiếp theo" }));
		await screen.findByText("Trang 2 / 2");
		await user.type(
			screen.getByLabelText("Tìm theo câu hỏi hoặc câu trả lời"),
			"  bản đồ  {enter}"
		);
		expect(await screen.findByText("Không có hồ sơ phù hợp với bộ lọc.")).toBeVisible();
		expect(aiInvestigationsService.list).toHaveBeenLastCalledWith(
			{ scope: "ALL", page: 1, q: "bản đồ" },
			expect.any(AbortSignal)
		);
		expect(overview.getByText("24", { exact: true })).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
		expect(await screen.findByRole("button", { name: /^Báo cáo nguy hiểm/ })).toBeVisible();
	});

	it("uses the existing sidebar and filters the combined list by review status", async () => {
		const list = investigationList();
		const notUseful = investigationList(notUsefulInvestigationFixture);
		vi.mocked(aiInvestigationsService.list).mockImplementation(async ({ scope, page }) => ({
			...list,
			items:
				scope === "NOT_USEFUL"
					? notUseful.items
					: scope === "UNSAFE"
						? list.items
						: [...list.items, ...notUseful.items],
			pagination: { page, limit: 20, total: 21, totalPages: 2 },
		}));
		const user = displayPage();
		const table = within(await screen.findByRole("table", { name: "Danh sách hồ sơ điều tra" }));
		expect(table.getByText("Báo cáo nguy hiểm")).toBeVisible();
		expect(table.getByText("Phản hồi chưa hữu ích")).toBeVisible();
		expect(screen.getAllByRole("navigation", { name: "Điều hướng quản trị" })).toHaveLength(1);
		expect(screen.getByRole("link", { name: "Phân tích & xử lý phản hồi AI" })).toHaveAttribute(
			"href",
			"/admin/ai-investigations"
		);
		const categories = within(screen.getByRole("tablist", { name: "Loại hồ sơ" }));
		const all = categories.getByRole("tab", { name: "Tất cả hồ sơ", selected: true });
		const unsafe = categories.getByRole("tab", { name: "Báo cáo nguy hiểm" });
		const lower = categories.getByRole("tab", { name: "Chưa hữu ích" });
		expect(unsafe.querySelector(".lucide-shield-alert")).toBeInTheDocument();
		expect(lower.querySelector(".lucide-thumbs-down")).toBeInTheDocument();
		expect(
			table
				.getByRole("button", { name: /^Báo cáo nguy hiểm/ })
				.querySelector(".lucide-shield-alert")
		).toBeInTheDocument();
		expect(
			table
				.getByRole("button", { name: /^Phản hồi chưa hữu ích/ })
				.querySelector(".lucide-thumbs-down")
		).toBeInTheDocument();
		expect(table.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
			"Hồ sơ",
			"Câu hỏi / Ngữ cảnh",
			"Thời gian",
			"Xem xét",
			"Phân tích",
			"Kỹ thuật",
		]);
		expect(table.queryByRole("button", { name: /xem hồ sơ/i })).not.toBeInTheDocument();
		const lowerRow = within(table.getByRole("row", { name: /^Phản hồi chưa hữu ích/ }));
		expect(lowerRow.getByRole("cell", { name: "Không áp dụng" })).toBeVisible();
		expect(lowerRow.getByRole("cell", { name: "Phân tích thất bại" })).toBeVisible();
		expect(lowerRow.getByRole("cell", { name: "Đã bàn giao" })).toBeVisible();
		expect(aiInvestigationsService.list).toHaveBeenCalledWith(
			{ scope: "ALL", page: 1 },
			expect.any(AbortSignal)
		);
		all.focus();
		await user.keyboard("{ArrowRight}");
		expect(unsafe).toHaveFocus();
		expect(unsafe).toHaveAttribute("aria-selected", "true");
		await user.selectOptions(screen.getByLabelText("Trạng thái xem xét"), "reviewing");
		await user.click(await screen.findByRole("button", { name: "Tiếp theo" }));
		expect(aiInvestigationsService.list).toHaveBeenLastCalledWith(
			{ scope: "UNSAFE", reviewStatus: "reviewing", page: 2 },
			expect.any(AbortSignal)
		);
		await user.click(lower);
		await screen.findByRole("button", { name: /^Phản hồi chưa hữu ích/ });
		expect(screen.queryByLabelText("Trạng thái xem xét")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Báo cáo nguy hiểm/ })).not.toBeInTheDocument();
		expect(aiInvestigationsService.list).toHaveBeenLastCalledWith(
			{ scope: "NOT_USEFUL", reviewStatus: undefined, page: 1 },
			expect.any(AbortSignal)
		);
	});

	it("selects and replaces details in the same panel, then restores focus on close", async () => {
		const list = investigationList();
		vi.mocked(aiInvestigationsService.list).mockResolvedValue({
			...list,
			items: [...list.items, ...investigationList(notUsefulInvestigationFixture).items],
		});
		vi.mocked(aiInvestigationsService.detail).mockImplementation(async (id) =>
			id === investigationFixture.id ? investigationFixture : notUsefulInvestigationFixture
		);
		const user = displayPage();
		const unsafe = await screen.findByRole("button", { name: /^Báo cáo nguy hiểm/ });
		const lower = screen.getByRole("button", { name: /^Phản hồi chưa hữu ích/ });
		expect(aiInvestigationsService.detail).not.toHaveBeenCalled();
		unsafe.focus();
		await user.keyboard("{Enter}");
		const panel = screen.getByRole("region", { name: "Chi tiết hồ sơ" });
		expect(within(panel).getByRole("heading", { name: "Chi tiết hồ sơ" })).toHaveFocus();
		expect(unsafe.closest("tr")).toHaveAttribute("data-selected", "true");
		await within(panel).findByText(investigationFixture.evidence?.answer ?? "");
		await user.click(lower);
		expect(screen.getByRole("region", { name: "Chi tiết hồ sơ" })).toBe(panel);
		await within(panel).findByText(notUsefulInvestigationFixture.evidence?.answer ?? "");
		expect(within(panel).getByText("Do thiết bị gửi kèm phản hồi")).toBeVisible();
		expect(within(panel).queryByText("Chờ xem xét")).not.toBeInTheDocument();
		expect(lower).toHaveAttribute("aria-expanded", "true");
		expect(unsafe).toHaveAttribute("aria-expanded", "false");
		await user.click(within(panel).getByRole("button", { name: "Đóng chi tiết hồ sơ" }));
		expect(panel).not.toBeInTheDocument();
		expect(lower).toHaveFocus();
		expect(aiInvestigationsService.detail).toHaveBeenCalledTimes(2);
		expect(aiInvestigationsService.update).not.toHaveBeenCalled();
	});

	it("shows loading, empty results and a localized access error", async () => {
		vi.mocked(aiInvestigationsService.list)
			.mockResolvedValueOnce({
				...investigationList(),
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			})
			.mockRejectedValueOnce(httpError(403));
		const user = displayPage();
		expect(screen.getByRole("status")).toHaveTextContent("Đang tải danh sách hồ sơ");
		expect(await screen.findByText("Chưa có hồ sơ phản hồi.")).toBeVisible();
		const reload = screen.getByRole("button", { name: "Tải lại danh sách" });
		expect(reload.textContent).toBe("");
		await user.click(reload);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Bạn không có quyền truy cập hồ sơ điều tra."
		);
		expect(screen.queryByText("Raw upstream failure")).not.toBeInTheDocument();
	});

	it("keeps the list available during detail loading and retries a failed detail read", async () => {
		let rejectRead!: (reason: unknown) => void;
		vi.mocked(aiInvestigationsService.detail).mockReturnValueOnce(
			new Promise((_, reject) => {
				rejectRead = reject;
			})
		);
		const user = displayPage();
		await user.click(await screen.findByRole("button", { name: /^Báo cáo nguy hiểm/ }));
		const panel = within(screen.getByRole("region", { name: "Chi tiết hồ sơ" }));
		expect(panel.getByRole("status")).toHaveTextContent("Đang tải hồ sơ");
		expect(screen.getByRole("table", { name: "Danh sách hồ sơ điều tra" })).toBeVisible();
		rejectRead(httpError(503));
		expect(await panel.findByRole("alert")).toHaveTextContent(
			"Không thể tải hoặc cập nhật dữ liệu"
		);
		await user.click(panel.getByRole("button", { name: "Thử tải lại" }));
		expect(await panel.findByRole("heading", { name: "Tổng quan hồ sơ" })).toBeVisible();
		expect(aiInvestigationsService.detail).toHaveBeenCalledTimes(2);
		expect(aiInvestigationsService.update).not.toHaveBeenCalled();
	});

	it("renders authoritative evidence as text and opens related cases by group", async () => {
		const user = displayPage();
		const panel = await displayCase(user);
		expect(panel.getByText("Chưa xác định")).toBeVisible();
		expect(panel.getByText("Đối chiếu dấu vết")).toBeVisible();
		const answer = panel.getByText("<b>Tiếp tục đi theo lối mòn.</b>");
		expect(answer.querySelector("b")).toBeNull();
		expect(panel.getByRole("link", { name: "Nguồn 1" })).toHaveAttribute(
			"href",
			"#ai-investigation-source-1"
		);
		expect(panel.getByText(/Hướng dẫn đọc bản đồ/)).toBeVisible();
		expect(panel.getByText(/Nguồn 2 · Không còn truy cập được/)).toBeVisible();
		await user.click(panel.getByText("Dấu vết suy luận"));
		expect(panel.getByText("survival-safety-v1")).toBeVisible();
		expect(screen.queryByText(investigationFixture.id)).not.toBeInTheDocument();
		await user.click(panel.getByRole("button", { name: "Trích dẫn không khớp · 2 hồ sơ" }));
		expect(screen.queryByRole("region", { name: "Chi tiết hồ sơ" })).not.toBeInTheDocument();
		expect(aiInvestigationsService.list).toHaveBeenLastCalledWith(
			{ scope: "ALL", groupId: investigationFixture.groups[0].id, page: 1 },
			expect.any(AbortSignal)
		);
	});

	it.each(["PENDING", "FAILED"] as const)(
		"keeps review available with analysis %s and missing evidence",
		async (processingStatus) => {
			vi.mocked(aiInvestigationsService.detail).mockResolvedValue({
				...investigationFixture,
				processingStatus,
				report: null,
				evidence: null,
				sources: [],
				groups: [],
			});
			const panel = await displayCase(displayPage());
			expect(
				panel.getByText(processingStatus === "FAILED" ? "Phân tích thất bại" : "Chờ phân tích")
			).toBeVisible();
			expect(panel.getByText("Hồ sơ chưa có dữ liệu bằng chứng.")).toBeVisible();
			expect(panel.getByRole("button", { name: "Bắt đầu xem xét" })).toBeEnabled();
			expect(
				panel.queryByRole("button", { name: "Xác nhận kết quả xử lý" })
			).not.toBeInTheDocument();
		}
	);

	it("records review, handoff with validation, and a substantiated resolution", async () => {
		const reviewing: InvestigationDetail = {
			...investigationFixture,
			version: 2,
			reviewStatus: "reviewing",
			reviewerName: "Nguyễn Minh An",
		};
		const handedOff: InvestigationDetail = {
			...reviewing,
			version: 3,
			technicalStatus: "HANDED_OFF",
		};
		const closed: InvestigationDetail = {
			...handedOff,
			version: 4,
			reviewStatus: "actioned",
			technicalStatus: "VERIFIED_FIX",
			closedAt: investigationFixture.createdAt,
			history: [
				{
					version: 4,
					action: "AI_INVESTIGATION_RESOLVE",
					at: investigationFixture.createdAt,
					actorName: "Nguyễn Minh An",
					reviewStatus: "actioned",
					technicalStatus: "VERIFIED_FIX",
					verification: "Đã đối chiếu bản đồ và tái hiện lượt trả lời.",
					resolutionNote: "Bản sửa đã bổ sung bước đối chiếu.",
					reference: null,
				},
				{
					version: 2,
					action: "AI_INVESTIGATION_START_REVIEW",
					at: investigationFixture.createdAt,
					actorName: "Nguyễn Minh An",
					reviewStatus: "reviewing",
					technicalStatus: "OPEN",
					verification: null,
					resolutionNote: null,
					reference: null,
				},
			],
		};
		vi.mocked(aiInvestigationsService.detail)
			.mockResolvedValueOnce(investigationFixture)
			.mockResolvedValueOnce(reviewing)
			.mockResolvedValueOnce(handedOff)
			.mockResolvedValueOnce(closed);
		const success = vi.spyOn(toast, "success").mockImplementation(() => "toast");
		try {
			const user = displayPage();
			const panel = await displayCase(user);
			await user.click(panel.getByRole("button", { name: "Bắt đầu xem xét" }));
			await user.click(await panel.findByRole("button", { name: "Bàn giao kỹ thuật" }));
			await user.click(panel.getByRole("button", { name: "Lưu bàn giao" }));
			expect(panel.getByText(/Nhập mã hoặc đường dẫn Jira/)).toBeVisible();
			expect(aiInvestigationsService.update).toHaveBeenCalledTimes(1);
			await user.type(
				panel.getByRole("textbox", { name: /^Mã hoặc đường dẫn bàn giao/ }),
				"CTMS-343"
			);
			await user.type(
				panel.getByRole("textbox", { name: /^Nội dung cần xác minh/ }),
				"Đối chiếu tài liệu đã công bố."
			);
			await user.click(panel.getByRole("button", { name: "Lưu bàn giao" }));
			expect(await panel.findByText("Đã bàn giao")).toBeVisible();
			expect(panel.getByText("Đang xem xét")).toBeVisible();
			await user.click(await panel.findByRole("button", { name: "Xác nhận kết quả xử lý" }));
			await user.selectOptions(panel.getByLabelText("Kết luận"), "VERIFIED_FIX");
			await user.type(
				panel.getByLabelText("Phạm vi và kết quả xác minh"),
				"Đã đối chiếu bản đồ và tái hiện lượt trả lời."
			);
			await user.type(
				panel.getByLabelText("Ghi chú kết luận"),
				"Bản sửa đã bổ sung bước đối chiếu."
			);
			await user.click(panel.getByRole("button", { name: "Lưu kết luận và đóng hồ sơ" }));
			expect(await panel.findByText("Đã xử lý")).toBeVisible();
			expect(panel.getByText("Lịch sử xử lý")).toBeVisible();
			const [firstEvent, lastEvent] = panel.getAllByRole("heading", {
				name: /^(Bắt đầu xem xét|Xác nhận kết quả xử lý)$/,
			});
			expect(firstEvent).toHaveTextContent("Bắt đầu xem xét");
			expect(lastEvent).toHaveTextContent("Xác nhận kết quả xử lý");
			expect(
				panel.queryByRole("button", { name: "Xác nhận kết quả xử lý" })
			).not.toBeInTheDocument();
			expect(aiInvestigationsService.update).toHaveBeenNthCalledWith(1, investigationFixture.id, {
				action: "START_REVIEW",
				version: 1,
			});
			expect(aiInvestigationsService.update).toHaveBeenNthCalledWith(2, investigationFixture.id, {
				action: "HANDOFF",
				version: 2,
				reference: "CTMS-343",
				verification: "Đối chiếu tài liệu đã công bố.",
			});
			expect(aiInvestigationsService.update).toHaveBeenNthCalledWith(
				3,
				investigationFixture.id,
				expect.objectContaining({
					action: "RESOLVE",
					disposition: "VERIFIED_FIX",
					version: 3,
					reference: null,
				})
			);
			expect(success).toHaveBeenLastCalledWith("Đã lưu kết luận và đóng hồ sơ.");
		} finally {
			success.mockRestore();
		}
	});

	it("refreshes the case after a 409 without resending the action", async () => {
		vi.mocked(aiInvestigationsService.update).mockRejectedValueOnce(httpError(409));
		vi.mocked(aiInvestigationsService.detail)
			.mockResolvedValueOnce(investigationFixture)
			.mockResolvedValueOnce({ ...investigationFixture, version: 2, reviewStatus: "reviewing" });
		const error = vi.spyOn(toast, "error").mockImplementation(() => "toast");
		try {
			const user = displayPage();
			const panel = await displayCase(user);
			await user.click(panel.getByRole("button", { name: "Bắt đầu xem xét" }));
			expect(await panel.findByRole("button", { name: "Xác nhận kết quả xử lý" })).toBeVisible();
			expect(aiInvestigationsService.update).toHaveBeenCalledTimes(1);
			await waitFor(() => expect(aiInvestigationsService.list).toHaveBeenCalledTimes(2));
			expect(error).toHaveBeenCalledWith(expect.stringContaining("Hồ sơ vừa thay đổi"));
		} finally {
			error.mockRestore();
		}
	});

	it("keeps a restricted report hidden while displaying the permitted case detail", async () => {
		vi.mocked(aiInvestigationsService.detail).mockResolvedValue({
			...investigationFixture,
			report: null,
			reportRestricted: true,
			groups: [],
		});
		const panel = await displayCase(displayPage());
		expect(panel.getByText(/nguồn dùng để phân tích không còn quyền truy cập/)).toBeVisible();
		expect(panel.queryByText("Bản trả lời thiếu bước đối chiếu.")).not.toBeInTheDocument();
		expect(panel.getByText(investigationFixture.evidence?.question ?? "")).toBeVisible();
	});
});

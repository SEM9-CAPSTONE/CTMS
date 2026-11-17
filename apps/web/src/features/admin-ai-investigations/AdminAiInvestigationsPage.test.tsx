import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { investigationFixture, investigationList } from "../../../tests/fixtures/ai-investigations";
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
	await user.click(await screen.findByRole("button", { name: /^Xem báo cáo nguy hiểm/ }));
	const dialog = within(await screen.findByRole("dialog"));
	await dialog.findByText("Báo cáo điều tra");
	return dialog;
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
		expect(await screen.findByRole("heading", { name: "Điều tra phản hồi AI" })).toBeVisible();
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

	it("uses the existing sidebar and sends filters and pagination to the Unsafe queue", async () => {
		vi.mocked(aiInvestigationsService.list).mockResolvedValue({
			...investigationList(),
			pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
		});
		const user = displayPage();
		expect(await screen.findByRole("table", { name: "Danh sách hồ sơ điều tra" })).toBeVisible();
		expect(screen.getAllByRole("navigation", { name: "Điều hướng quản trị" })).toHaveLength(1);
		expect(screen.getByRole("link", { name: "Điều tra phản hồi AI" })).toHaveAttribute(
			"href",
			"/admin/ai-investigations"
		);
		expect(aiInvestigationsService.list).toHaveBeenCalledWith(
			{ scope: "UNSAFE", page: 1 },
			expect.any(AbortSignal)
		);
		await user.selectOptions(screen.getByLabelText("Trạng thái xem xét"), "reviewing");
		await user.click(await screen.findByRole("button", { name: "Tiếp theo" }));
		expect(aiInvestigationsService.list).toHaveBeenLastCalledWith(
			{ scope: "UNSAFE", reviewStatus: "reviewing", page: 2 },
			expect.any(AbortSignal)
		);
		await user.selectOptions(screen.getByLabelText("Loại hồ sơ"), "ALL");
		expect(screen.queryByLabelText("Trạng thái xem xét")).not.toBeInTheDocument();
		expect(aiInvestigationsService.list).toHaveBeenLastCalledWith(
			{ scope: "ALL", page: 1 },
			expect.any(AbortSignal)
		);
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
		expect(await screen.findByText("Không có hồ sơ phù hợp với bộ lọc.")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Tải lại danh sách" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Bạn không có quyền truy cập hồ sơ điều tra."
		);
		expect(screen.queryByText("Raw upstream failure")).not.toBeInTheDocument();
	});

	it("renders authoritative evidence as text and opens related cases by group", async () => {
		const user = displayPage();
		const dialog = await displayCase(user);
		expect(dialog.getByText("Chưa xác định")).toBeVisible();
		const answer = dialog.getByText("<b>Tiếp tục đi theo lối mòn.</b>");
		expect(answer.querySelector("b")).toBeNull();
		expect(dialog.getByRole("link", { name: "Nguồn 1" })).toHaveAttribute(
			"href",
			"#ai-investigation-source-1"
		);
		expect(dialog.getByText(/Hướng dẫn đọc bản đồ/)).toBeVisible();
		expect(dialog.getByText(/Nguồn 2 · Không còn truy cập được/)).toBeVisible();
		await user.click(dialog.getByText("Dấu vết suy luận"));
		expect(dialog.getByText("survival-safety-v1")).toBeVisible();
		expect(screen.queryByText(investigationFixture.id)).not.toBeInTheDocument();
		await user.click(dialog.getByRole("button", { name: "Trích dẫn không khớp · 2 hồ sơ" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
			const dialog = await displayCase(displayPage());
			expect(
				dialog.getByText(processingStatus === "FAILED" ? "Phân tích thất bại" : "Chờ phân tích")
			).toBeVisible();
			expect(dialog.getByText("Hồ sơ chưa có dữ liệu bằng chứng.")).toBeVisible();
			expect(dialog.getByRole("button", { name: "Tiếp nhận xem xét" })).toBeEnabled();
			expect(dialog.queryByRole("button", { name: "Ghi kết luận" })).not.toBeInTheDocument();
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
			const dialog = await displayCase(user);
			await user.click(dialog.getByRole("button", { name: "Tiếp nhận xem xét" }));
			await user.click(await dialog.findByRole("button", { name: "Ghi nhận bàn giao" }));
			await user.click(dialog.getByRole("button", { name: "Lưu bàn giao" }));
			expect(dialog.getByText(/Nhập mã hoặc đường dẫn Jira/)).toBeVisible();
			expect(aiInvestigationsService.update).toHaveBeenCalledTimes(1);
			await user.type(
				dialog.getByRole("textbox", { name: /^Mã hoặc đường dẫn bàn giao/ }),
				"CTMS-343"
			);
			await user.type(
				dialog.getByRole("textbox", { name: /^Nội dung cần xác minh/ }),
				"Đối chiếu tài liệu đã công bố."
			);
			await user.click(dialog.getByRole("button", { name: "Lưu bàn giao" }));
			expect(await dialog.findByText("Đã ghi nhận bàn giao")).toBeVisible();
			expect(dialog.getByText("Đang xem xét")).toBeVisible();
			await user.click(await dialog.findByRole("button", { name: "Ghi kết luận" }));
			await user.selectOptions(dialog.getByLabelText("Kết luận"), "VERIFIED_FIX");
			await user.type(
				dialog.getByLabelText("Phạm vi và kết quả xác minh"),
				"Đã đối chiếu bản đồ và tái hiện lượt trả lời."
			);
			await user.type(
				dialog.getByLabelText("Ghi chú kết luận"),
				"Bản sửa đã bổ sung bước đối chiếu."
			);
			await user.click(dialog.getByRole("button", { name: "Lưu kết luận và đóng hồ sơ" }));
			expect(await dialog.findByText("Đã xử lý")).toBeVisible();
			expect(dialog.getByText("Lịch sử xử lý")).toBeVisible();
			expect(dialog.queryByRole("button", { name: "Ghi kết luận" })).not.toBeInTheDocument();
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
			const dialog = await displayCase(user);
			await user.click(dialog.getByRole("button", { name: "Tiếp nhận xem xét" }));
			expect(await dialog.findByRole("button", { name: "Ghi kết luận" })).toBeVisible();
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
		const dialog = await displayCase(displayPage());
		expect(dialog.getByText(/nguồn dùng để phân tích không còn quyền truy cập/)).toBeVisible();
		expect(dialog.queryByText("Bản trả lời thiếu bước đối chiếu.")).not.toBeInTheDocument();
		expect(dialog.getByText(investigationFixture.evidence?.question ?? "")).toBeVisible();
	});
});

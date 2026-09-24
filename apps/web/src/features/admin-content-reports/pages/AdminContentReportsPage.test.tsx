import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { REPORT_ACTIONS, REPORT_STATUS_LABELS, reportActions } from "../constants";
import { contentReportsService } from "../services/content-reports.service";
import { type ContentReport, type ReportQueue, ReportStatus } from "../types";
import { AdminContentReportsPage } from "./AdminContentReportsPage";

const report: ContentReport = {
	id: "report-1",
	reporter: { id: "reporter-1", fullName: "Người gửi thử nghiệm" },
	targetType: "review",
	targetId: "target-1",
	reason: "Nội dung sai lệch",
	status: ReportStatus.PENDING,
	createdAt: "2026-09-01T00:00:00Z",
	updatedAt: "2026-09-01T00:00:00Z",
};
const queue: ReportQueue = {
	items: [report],
	pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
async function openDetail() {
	render(<AdminContentReportsPage />);
	await userEvent.click(await screen.findByRole("button", { name: `Xem báo cáo ${report.id}` }));
	const panel = screen.getByRole("region", { name: "Chi tiết báo cáo" });
	await within(panel).findByText(report.reason);
	return within(panel);
}
describe("Content Reports Admin UI", () => {
	beforeEach(() => {
		// Router tests can preload this module with isolate:false. Spy on the same
		// service object instead of replacing a module already held by the hooks.
		vi.spyOn(contentReportsService, "list").mockResolvedValue(queue);
		vi.spyOn(contentReportsService, "detail").mockResolvedValue(report);
		vi.spyOn(contentReportsService, "transition").mockResolvedValue(report);
	});
	afterEach(() => {
		vi.mocked(contentReportsService.list).mockRestore();
		vi.mocked(contentReportsService.detail).mockRestore();
		vi.mocked(contentReportsService.transition).mockRestore();
	});
	it("shows loading before authoritative queue arrives", async () => {
		const pending = deferred<ReportQueue>();
		vi.mocked(contentReportsService.list).mockReturnValue(pending.promise);
		render(<AdminContentReportsPage />);
		expect(screen.getByText("Đang tải danh sách báo cáo...")).toBeInTheDocument();
		await act(async () => pending.resolve(queue));
		expect(await screen.findByText(report.reason)).toBeInTheDocument();
	});
	it("renders authoritative queue and only report operations", async () => {
		render(<AdminContentReportsPage />);
		const table = await screen.findByRole("table");
		for (const value of [
			report.reporter.fullName ?? "",
			report.reporter.id,
			report.targetType,
			report.targetId,
			report.reason,
			"Chờ xử lý",
		])
			expect(within(table).getByText(value)).toBeInTheDocument();
		expect(contentReportsService.list).toHaveBeenCalledWith(1, 20);
		expect(
			screen.queryByRole("button", { name: /Xóa nội dung|Ẩn nội dung|Khóa tài khoản|Hủy đặt chỗ/ })
		).not.toBeInTheDocument();
	});
	it("renders empty pagination safely", async () => {
		vi.mocked(contentReportsService.list).mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
		render(<AdminContentReportsPage />);
		expect(await screen.findByText("Không có báo cáo trên trang này.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
	});
	it("retries queue network failure", async () => {
		vi.mocked(contentReportsService.list).mockRejectedValueOnce(new Error("offline"));
		render(<AdminContentReportsPage />);
		expect(await screen.findByRole("alert")).toHaveTextContent("Không thể kết nối");
		await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(await screen.findByText(report.reason)).toBeInTheDocument();
		expect(contentReportsService.list).toHaveBeenCalledTimes(2);
	});
	it("uses server pagination for next/previous pages", async () => {
		vi.mocked(contentReportsService.list)
			.mockResolvedValueOnce({
				...queue,
				pagination: { ...queue.pagination, total: 21, totalPages: 2 },
			})
			.mockResolvedValueOnce({
				...queue,
				pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
			});
		render(<AdminContentReportsPage />);
		await userEvent.click(await screen.findByRole("button", { name: "Trang sau" }));
		await screen.findByText("Trang 2 / 2");
		expect(contentReportsService.list).toHaveBeenLastCalledWith(2, 20);
		await userEvent.click(screen.getByRole("button", { name: "Trang trước" }));
		await waitFor(() => expect(contentReportsService.list).toHaveBeenLastCalledWith(1, 20));
	});
	it("shows all authoritative detail fields and pending actions", async () => {
		const panel = await openDetail();
		for (const value of [
			report.id,
			report.reporter.id,
			report.reporter.fullName ?? "",
			report.targetType,
			report.targetId,
			report.reason,
			"Chờ xử lý",
			"Ngày tạo",
			"Cập nhật lần cuối",
		])
			expect(panel.getByText(value)).toBeInTheDocument();
		for (const action of REPORT_ACTIONS)
			expect(panel.getByRole("button", { name: action.label })).toBeEnabled();
		expect(panel.getByText(/Các thao tác chỉ cập nhật trạng thái báo cáo/)).toBeInTheDocument();
		expect(panel.getAllByRole("button")).toHaveLength(4);
	});
	it("reviewing offers only Actioned and Rejected", async () => {
		vi.mocked(contentReportsService.detail).mockResolvedValue({
			...report,
			status: ReportStatus.REVIEWING,
		});
		const panel = await openDetail();
		expect(panel.queryByRole("button", { name: REPORT_ACTIONS[0].label })).not.toBeInTheDocument();
		for (const action of REPORT_ACTIONS.slice(1))
			expect(panel.getByRole("button", { name: action.label })).toBeEnabled();
		expect(panel.getAllByRole("button")).toHaveLength(3);
	});
	it.each([ReportStatus.ACTIONED, ReportStatus.REJECTED])(
		"hides unsupported actions for %s",
		async (status) => {
			vi.mocked(contentReportsService.detail).mockResolvedValue({ ...report, status });
			const panel = await openDetail();
			for (const action of REPORT_ACTIONS)
				expect(panel.queryByRole("button", { name: action.label })).not.toBeInTheDocument();
		}
	);
	it.each(
		[ReportStatus.PENDING, ReportStatus.REVIEWING].flatMap((from) =>
			reportActions(from).map((action) => ({ ...action, from }))
		)
	)(
		"sends authoritative expectedStatus for $from -> $status and refreshes both reads",
		async ({ status, label, from }) => {
			const saved = { ...report, status };
			vi.mocked(contentReportsService.transition).mockResolvedValue(saved);
			vi.mocked(contentReportsService.detail)
				.mockResolvedValueOnce({ ...report, status: from })
				.mockResolvedValue(saved);
			vi.mocked(contentReportsService.list)
				.mockResolvedValueOnce(queue)
				.mockResolvedValue({ ...queue, items: [saved] });
			const panel = await openDetail();
			await userEvent.click(panel.getByRole("button", { name: label }));
			await waitFor(() => expect(contentReportsService.detail).toHaveBeenCalledTimes(2));
			expect(contentReportsService.transition).toHaveBeenCalledExactlyOnceWith(report.id, {
				expectedStatus: from,
				status,
			});
			expect(contentReportsService.list).toHaveBeenCalledTimes(2);
			expect(panel.queryByRole("button", { name: label })).not.toBeInTheDocument();
		}
	);
	it.each([ReportStatus.PENDING, ReportStatus.REVIEWING])(
		"blocks repeated submit from %s until response",
		async (from) => {
			vi.mocked(contentReportsService.detail).mockResolvedValue({ ...report, status: from });
			const pending = deferred<ContentReport>();
			vi.mocked(contentReportsService.transition).mockReturnValue(pending.promise);
			const panel = await openDetail();
			const button = panel.getByRole("button", { name: REPORT_ACTIONS[1].label });
			fireEvent.click(button);
			fireEvent.click(button);
			expect(contentReportsService.transition).toHaveBeenCalledTimes(1);
			expect(panel.getByText(REPORT_STATUS_LABELS[from])).toBeInTheDocument();
			for (const action of reportActions(from))
				expect(panel.getByRole("button", { name: action.label })).toBeDisabled();
			expect(panel.getByRole("button", { name: "Đóng chi tiết" })).toBeDisabled();
			await act(async () => pending.resolve({ ...report, status: ReportStatus.ACTIONED }));
		}
	);
	it.each([ReportStatus.PENDING, ReportStatus.REVIEWING])(
		"on 409 from %s refetches without retrying PATCH",
		async (from) => {
			vi.mocked(contentReportsService.transition).mockRejectedValue(
				new HttpError("conflict", 409, null)
			);
			vi.mocked(contentReportsService.detail)
				.mockResolvedValueOnce({ ...report, status: from })
				.mockResolvedValue({ ...report, status: ReportStatus.REJECTED });
			const panel = await openDetail();
			await userEvent.click(panel.getByRole("button", { name: REPORT_ACTIONS[1].label }));
			expect(await panel.findByRole("alert")).toHaveTextContent("Trạng thái báo cáo đã thay đổi");
			expect(await panel.findByText("Đã từ chối")).toBeInTheDocument();
			expect(contentReportsService.list).toHaveBeenCalledTimes(2);
			expect(contentReportsService.detail).toHaveBeenCalledTimes(2);
			expect(contentReportsService.transition).toHaveBeenCalledTimes(1);
		}
	);
	it.each([
		[401, "Phiên đăng nhập"],
		[403, "không có quyền"],
		[404, "không còn tồn tại"],
		[422, "không hợp lệ"],
		[500, "Không thể xử lý"],
	] as const)("handles mutation HTTP %s", async (status, message) => {
		vi.mocked(contentReportsService.transition).mockRejectedValue(
			new HttpError("private server detail", status, null)
		);
		const panel = await openDetail();
		await userEvent.click(panel.getByRole("button", { name: REPORT_ACTIONS[0].label }));
		expect(await panel.findByRole("alert")).toHaveTextContent(message);
		expect(panel.queryByText("private server detail")).not.toBeInTheDocument();
		if ([401, 403, 404].includes(status))
			expect(
				panel.queryByRole("button", { name: REPORT_ACTIONS[0].label })
			).not.toBeInTheDocument();
	});
	it("retries detail error", async () => {
		vi.mocked(contentReportsService.detail).mockRejectedValueOnce(
			new HttpError("missing", 404, null)
		);
		render(<AdminContentReportsPage />);
		await userEvent.click(await screen.findByRole("button", { name: `Xem báo cáo ${report.id}` }));
		expect(await screen.findByRole("alert")).toHaveTextContent("không còn tồn tại");
		await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(await screen.findByRole("button", { name: REPORT_ACTIONS[0].label })).toBeEnabled();
	});
	it("discards an older detail response after a new selection", async () => {
		const pending = deferred<ContentReport>();
		const newer = { ...report, id: "report-2", reason: "New selection" };
		vi.mocked(contentReportsService.list).mockResolvedValue({ ...queue, items: [report, newer] });
		vi.mocked(contentReportsService.detail)
			.mockReturnValueOnce(pending.promise)
			.mockResolvedValue(newer);
		render(<AdminContentReportsPage />);
		await userEvent.click(await screen.findByRole("button", { name: `Xem báo cáo ${report.id}` }));
		await userEvent.click(screen.getByRole("button", { name: `Xem báo cáo ${newer.id}` }));
		const panel = within(screen.getByRole("region", { name: "Chi tiết báo cáo" }));
		await panel.findByText(newer.reason);
		await act(async () => pending.resolve(report));
		expect(panel.getByText(newer.reason)).toBeInTheDocument();
		expect(panel.queryByText(report.reason)).not.toBeInTheDocument();
	});
});

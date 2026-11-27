import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../shared/components";
import { termsService } from "../services/terms.service";
import type { TermsVersionDetail } from "../types";
import { AdminTermsManagementPage } from "./AdminTermsManagementPage";

vi.mock("../../admin-layout/components/AdminLayout", () => ({
	AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const MOCK_CURRENT: TermsVersionDetail = {
	id: "terms-1",
	version: "1.0",
	title: "Điều khoản và Chính sách sử dụng CTMS",
	summary: "Phiên bản chính thức đầu tiên.",
	effectiveDate: "2026-11-27",
	isActive: true,
	requiresReconsent: true,
	publishedAt: "2026-11-27T00:00:00.000Z",
	sections: [
		{
			number: 1,
			slug: "quy-dinh-chung",
			title: "Quy định chung",
			subsections: [
				{
					code: "1.1",
					title: "Phạm vi áp dụng",
					body: "Áp dụng cho toàn bộ hệ thống CTMS.",
				},
			],
		},
	],
};

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<AdminTermsManagementPage onLogout={vi.fn()} onOpenPublicTerms={vi.fn()} />
			</ToastProvider>
		</QueryClientProvider>
	);
}

describe("AdminTermsManagementPage", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
		vi.spyOn(termsService, "getCurrent").mockResolvedValue(MOCK_CURRENT);
		vi.spyOn(termsService, "listVersions").mockResolvedValue([MOCK_CURRENT]);
	});

	it("renders the 3-column workspace without sub-tabs or bottom version history table and uses Cập nhật phiên bản", async () => {
		renderPage();

		expect(
			await screen.findByRole("heading", { name: "Điều khoản và Chính sách sử dụng" })
		).toBeInTheDocument();
		expect(await screen.findByRole("heading", { name: "Phiên bản" })).toBeInTheDocument();
		expect(
			await screen.findByRole("heading", { name: "Chỉnh sửa phiên bản v1.0" })
		).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Cập nhật phiên bản" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cập nhật phiên bản" })).toBeInTheDocument();

		// Removed subtitle, sub-tabs (Image 2), and bottom version history table
		expect(
			screen.queryByText(/Quản lý nội dung, phiên bản và phạm vi áp dụng/i)
		).not.toBeInTheDocument();
		expect(screen.queryByText("Thống kê chấp thuận")).not.toBeInTheDocument();
		expect(screen.queryByText("Cài đặt")).not.toBeInTheDocument();
		expect(screen.queryByText("Lịch sử phiên bản")).not.toBeInTheDocument();
		expect(screen.queryByText(/Công bố phiên bản/i)).not.toBeInTheDocument();
	});

	it("renders Word-like toolbar with font size selector and without Thêm mục mới button", async () => {
		const user = userEvent.setup();
		renderPage();

		await screen.findByRole("heading", { name: "Chỉnh sửa phiên bản v1.0" });
		const editor = screen.getByRole("textbox", {
			name: "Trình soạn thảo nội dung Điều khoản và Chính sách",
		});
		await waitFor(() => {
			expect(editor).toHaveTextContent("1. Quy định chung");
			expect(editor).toHaveTextContent("1.1. Phạm vi áp dụng");
		});
		expect(screen.queryByRole("button", { name: /Thêm mục mới/i })).not.toBeInTheDocument();

		const fontSizeSelect = screen.getByRole("combobox", { name: "Cỡ chữ" });
		expect(fontSizeSelect).toHaveValue("14");
		await user.selectOptions(fontSizeSelect, "18");
		expect(fontSizeSelect).toHaveValue("18");
	});

	it("creates a new version draft, opens preview, and publishes via Cập nhật phiên bản", async () => {
		const publishSpy = vi.spyOn(termsService, "publishVersion").mockResolvedValue({
			...MOCK_CURRENT,
			id: "terms-2",
			version: "1.1",
			summary: "Cập nhật quy định an toàn mới.",
		});
		const user = userEvent.setup();
		renderPage();

		await user.click(await screen.findByRole("button", { name: /Tạo phiên bản mới/i }));
		expect(screen.getByRole("heading", { name: "Chỉnh sửa phiên bản v1.1" })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Xem trước/i }));
		expect(
			await screen.findByRole("heading", { name: "Xem trước Điều khoản và Chính sách" })
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Đóng" }));

		await user.type(screen.getByLabelText(/Tóm tắt thay đổi/i), "Cập nhật quy định an toàn mới.");
		await user.click(screen.getByRole("button", { name: "Cập nhật phiên bản" }));

		await waitFor(() => {
			expect(publishSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					version: "1.1",
					summary: "Cập nhật quy định an toàn mới.",
					requiresReconsent: true,
				})
			);
		});
		expect(await screen.findByTestId("toast-success")).toBeInTheDocument();
	});
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { sourceSchema } from "../schema/source.schema";
import { survivalDocumentsService as service } from "../services/survival-documents.service";
import type { DocumentDetail, SourceMetadata, SourceReference } from "../types";
import { SurvivalDocumentsPage } from "./SurvivalDocumentsPage";

vi.mock("../../admin-layout/components/AdminLayout", () => ({
	AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const metadata: SourceMetadata = {
	sourceTitle: "Tài liệu giả định",
	publisher: "Tổ chức giả định",
	classification: "TREKKING_SAFETY",
	locale: "vi",
	originalLocale: "vi",
	retrievedAt: "2026-01-01",
	licenseType: "Giấy phép giả định",
	permissionEvidence: "Tác giả giả định cho phép sử dụng",
	attribution: "Tác giả giả định",
	changeSummary: "Phiên bản đầu tiên",
};
const doc: DocumentDetail = {
	id: "document-1",
	revision: 1,
	versionCount: 1,
	currentPublishedVersionId: null,
	createdBy: "actor",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	processingSyncStatus: "NOT_PROCESSED",
	history: [],
	versions: [
		{
			id: "version-1",
			documentId: "document-1",
			versionNumber: 1,
			revision: 1,
			status: "DRAFT",
			metadata,
			rights: {
				rightsReviewStatus: "NOT_REVIEWED",
				sourceReviewConfirmed: false,
				internalRagUseAllowed: false,
				offlineRedistributionAllowed: false,
				translationAllowed: false,
				medicalContentReviewStatus: "NOT_REVIEWED",
				evidence: "",
			},
			originalVersionId: null,
			originalFilename: "fictional.pdf",
			checksum: "a".repeat(64),
			size: 100,
			contentType: "application/pdf",
			createdBy: "actor",
			createdAt: "2026-01-01",
			reviewedBy: null,
			reviewedAt: null,
			publishedBy: null,
			publishedAt: null,
			reason: null,
		},
	],
};
const reference: SourceReference = {
	id: "test-reference",
	publisher: "Fictional official publisher",
	title: "Fictional reference",
	category: "TREKKING_SAFETY",
	contentUrl: "https://example.org/manual",
	rightsPolicyUrl: "https://example.org/policy",
	language: "en",
	rightsNote: "Review required",
	reviewStatus: "NOT_REVIEWED",
	isApproved: false,
	internalRagUseAllowed: false,
	offlineRedistributionAllowed: false,
	translationAllowed: false,
};
const queue = { items: [{ ...doc, latestVersion: doc.versions[0] }], total: 1, page: 1, limit: 20 };
function view() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<SurvivalDocumentsPage />
		</QueryClientProvider>
	);
}
async function detail() {
	view();
	await userEvent.click(await screen.findByRole("button", { name: "Xem Tài liệu giả định" }));
	return within(await screen.findByRole("dialog"));
}
beforeEach(() => {
	vi.spyOn(service, "list").mockResolvedValue(queue);
	vi.spyOn(service, "detail").mockResolvedValue(structuredClone(doc));
	vi.spyOn(service, "references").mockResolvedValue({ items: [reference], maxBytes: 10485760 });
	vi.spyOn(service, "upload").mockResolvedValue(doc);
	vi.spyOn(service, "edit").mockResolvedValue(doc);
	vi.spyOn(service, "action").mockResolvedValue(doc);
});
afterEach(() => vi.restoreAllMocks());
describe("CTMS-050 Admin source management", () => {
	it("shows loading until authoritative list arrives", async () => {
		vi.mocked(service.list).mockReturnValue(new Promise(() => {}));
		view();
		expect(screen.getByText("Đang tải tài liệu…")).toBeInTheDocument();
	});
	it("renders actual list and empty state", async () => {
		vi.mocked(service.list).mockResolvedValue({ ...queue, items: [], total: 0 });
		view();
		expect(await screen.findByText("Chưa có tài liệu phù hợp.")).toBeInTheDocument();
		expect(screen.getByText("0 tài liệu trong kết quả")).toBeInTheDocument();
	});
	it.each([401, 403, 409, 503])(
		"displays server error %s without false success",
		async (status) => {
			vi.mocked(service.list).mockRejectedValue(new HttpError("Không thể tải nguồn", status, {}));
			view();
			expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải nguồn");
			expect(screen.queryByRole("button", { name: "Xuất bản" })).not.toBeInTheDocument();
		}
	);
	it("filters through the real service boundary", async () => {
		view();
		await screen.findByRole("table");
		fireEvent.change(screen.getByRole("combobox", { name: "Trạng thái" }), {
			target: { value: "IN_REVIEW" },
		});
		await waitFor(() =>
			expect(service.list).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: "IN_REVIEW", page: 1 })
			)
		);
	});
	it("prefills catalog metadata without fetching external content, uploading, or approving", async () => {
		const fetch = vi.spyOn(globalThis, "fetch");
		view();
		await userEvent.click(await screen.findByText("Gợi ý nguồn chính thống"));
		await userEvent.click(await screen.findByRole("button", { name: "Điền thông tin nguồn" }));
		expect(screen.getByLabelText("Tên tài liệu")).toHaveValue(reference.title);
		expect(screen.getByLabelText("Tổ chức xuất bản")).toHaveValue(reference.publisher);
		expect(screen.getByLabelText("Đường dẫn bản gốc")).toHaveValue(reference.contentUrl);
		expect(screen.getByLabelText("Minh chứng quyền sử dụng")).toHaveValue("");
		expect(screen.getByLabelText("Loại giấy phép")).toHaveValue("");
		expect(fetch).not.toHaveBeenCalled();
		expect(service.upload).not.toHaveBeenCalled();
		expect(service.action).not.toHaveBeenCalled();
		for (const link of screen.getAllByRole("link")) {
			expect(link).toHaveAttribute("rel", "noopener noreferrer");
		}
	});
	it("requires metadata and an actual supplied file", async () => {
		view();
		await userEvent.click(screen.getByRole("button", { name: "Thêm nguồn tài liệu" }));
		await userEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
		expect(await screen.findByText("Nhập tên tài liệu")).toBeInTheDocument();
		expect(service.upload).not.toHaveBeenCalled();
	});
	it("shows exact provenance, retained versions and draft-only actions", async () => {
		const panel = await detail();
		expect(panel.getByText("Bản nháp")).toBeInTheDocument();
		expect(panel.getByText(doc.versions[0].checksum)).toBeInTheDocument();
		expect(panel.getByRole("button", { name: "Gửi duyệt" })).toBeInTheDocument();
		expect(panel.queryByRole("button", { name: "Xuất bản" })).not.toBeInTheDocument();
	});
	it("blocks duplicate submissions and waits for server confirmation", async () => {
		let finish!: (value: DocumentDetail) => void;
		vi.mocked(service.action).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const panel = await detail();
		const button = panel.getByRole("button", { name: "Gửi duyệt" });
		fireEvent.click(button);
		fireEvent.click(button);
		await waitFor(() => expect(service.action).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(button).toBeDisabled());
		expect(panel.queryByText("Đã xuất bản")).not.toBeInTheDocument();
		finish(doc);
		await waitFor(() => expect(button).not.toBeDisabled());
	});
	it("renders stale conflict and reloads authoritative state", async () => {
		vi.mocked(service.action).mockRejectedValue(
			new HttpError("Tài liệu đã thay đổi. Vui lòng tải lại.", 409, {})
		);
		const panel = await detail();
		await userEvent.click(panel.getByRole("button", { name: "Gửi duyệt" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Tài liệu đã thay đổi");
		await waitFor(() => expect(service.detail).toHaveBeenCalledTimes(2));
	});
	it("keeps all review permissions undecided by default", async () => {
		vi.mocked(service.detail).mockResolvedValue({
			...doc,
			versions: [{ ...doc.versions[0], status: "IN_REVIEW" }],
		});
		const panel = await detail();
		for (const check of panel.getAllByRole("checkbox")) expect(check).not.toBeChecked();
		expect(panel.getByLabelText("Kết quả xác minh quyền")).toHaveValue("NOT_REVIEWED");
	});
	it("validates source metadata schema including locale and evidence", () => {
		expect(sourceSchema.safeParse(metadata).success).toBe(true);
		expect(
			sourceSchema.safeParse({ ...metadata, locale: "../../vi", permissionEvidence: "" }).success
		).toBe(false);
	});
});

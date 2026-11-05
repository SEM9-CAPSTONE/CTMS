import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { toast } from "../../../shared/components/Toast";
import { sourceSchema } from "../schema/source.schema";
import { survivalDocumentsService as service } from "../services/survival-documents.service";
import type { DocumentDetail, SourceMetadata } from "../types";
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
const queue = {
	items: [{ ...doc, latestVersion: doc.versions[0] }],
	total: 1,
	page: 1,
	limit: 20,
	maxBytes: 10485760,
};
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
	vi.spyOn(service, "upload").mockResolvedValue(doc);
	vi.spyOn(service, "importUrl").mockResolvedValue(doc);
	vi.spyOn(service, "edit").mockResolvedValue(doc);
	vi.spyOn(service, "action").mockResolvedValue(doc);
	vi.spyOn(service, "file").mockReturnValue(new Promise(() => {}));
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
		expect(await screen.findByText("Kho tài liệu đang trống.")).toBeInTheDocument();
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
			target: { value: "PUBLISHED" },
		});
		await waitFor(() =>
			expect(service.list).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: "PUBLISHED", page: 1 })
			)
		);
	});
	it("imports only the selected URL and keeps common metadata while switching modes", async () => {
		const fetch = vi.spyOn(globalThis, "fetch");
		const sourceUrl = "https://example.org/manual?download=1";
		const user = userEvent.setup();
		view();
		expect(screen.queryByText("Gợi ý nguồn chính thống")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /^Thêm tài liệu$/ }));
		await user.type(screen.getByLabelText(/^Tên tài liệu/), metadata.sourceTitle);
		const file = new File(["test bytes"], "fictional.pdf", { type: "application/pdf" });
		await user.upload(screen.getByLabelText("Tệp PDF"), file);
		await user.click(screen.getByRole("button", { name: "Nhập URL PDF" }));
		expect(screen.getByLabelText(/^Tên tài liệu/)).toHaveValue(metadata.sourceTitle);
		expect(screen.queryByLabelText("Tệp PDF")).not.toBeInTheDocument();
		await user.type(screen.getByLabelText(/URL (tệp )?PDF/), sourceUrl);
		await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
		await waitFor(() =>
			expect(service.importUrl).toHaveBeenCalledWith(
				expect.objectContaining({ sourceTitle: metadata.sourceTitle }),
				sourceUrl,
				undefined
			)
		);
		expect(fetch).not.toHaveBeenCalled();
		expect(service.upload).not.toHaveBeenCalled();
		expect(service.action).not.toHaveBeenCalled();
	});
	it("requires metadata and an actual supplied file", async () => {
		view();
		await userEvent.click(screen.getByRole("button", { name: /^Thêm tài liệu$/ }));
		await userEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
		expect(await screen.findByText("Nhập tên tài liệu")).toBeInTheDocument();
		expect(service.upload).not.toHaveBeenCalled();
	});
	it("saves the selected PDF and publishes that version without rights input", async () => {
		const notify = vi.spyOn(toast, "success");
		const user = userEvent.setup();
		view();
		await user.click(screen.getByRole("button", { name: /^Thêm tài liệu$/ }));
		const editor = within(await screen.findByRole("dialog", { name: "Thêm tài liệu sinh tồn" }));
		await user.type(editor.getByLabelText(/Tên tài liệu/), metadata.sourceTitle);
		const file = new File(["test bytes"], "fictional.pdf", { type: "application/pdf" });
		fireEvent.drop(editor.getByText("Kéo thả tệp PDF vào đây hoặc"), {
			dataTransfer: { files: [file] },
		});
		expect(editor.getByRole("button", { name: "Chọn tệp khác" })).toBeInTheDocument();
		await user.click(editor.getByRole("button", { name: "Xuất bản" }));

		expect(service.upload).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(service.action).toHaveBeenCalledWith(doc.id, doc.versions[0].id, "publish", {
				expectedRevision: doc.versions[0].revision,
			})
		);
		await waitFor(() => expect(notify).toHaveBeenCalledWith("Đã xuất bản tài liệu."));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
	it.each([
		["upload", "SOURCE_DUPLICATE_PDF", "Nội dung PDF đã tồn tại."],
		["upload", "SOURCE_DUPLICATE_PDF_NAME_AND_CONTENT", "Tên và nội dung PDF đã tồn tại."],
		["url", "SOURCE_DUPLICATE_PDF_NAME", "Tên tệp PDF đã tồn tại."],
	] as const)(
		"shows the existing PDF and opens its exact version after %s returns %s",
		async (method, code, message) => {
			const documentId = "e0653467-0be3-444f-a406-1df4b48b3b1b";
			const versionId = "59a2fa7e-301c-4d91-952a-e177cd96fbd2";
			const match = {
				...doc.versions[0],
				id: versionId,
				documentId,
				metadata: { ...metadata, sourceTitle: "Cẩm nang gốc" },
			};
			vi.mocked(service.detail).mockResolvedValue({
				...doc,
				id: documentId,
				versionCount: 2,
				versions: [
					{
						...doc.versions[0],
						documentId,
						versionNumber: 2,
						metadata: { ...metadata, sourceTitle: "Cẩm nang mới hơn" },
					},
					match,
				],
			});
			const mutation = method === "upload" ? service.upload : service.importUrl;
			vi.mocked(mutation).mockRejectedValue(
				new HttpError(message, 409, {
					code,
					documentId,
					versionId,
					versionNumber: 1,
					sourceTitle: match.metadata.sourceTitle,
				})
			);

			const user = userEvent.setup();
			view();
			await user.click(screen.getByRole("button", { name: /^Thêm tài liệu$/ }));
			await user.type(screen.getByLabelText(/^Tên tài liệu/), "Cẩm nang định thêm");
			if (method === "url") {
				await user.click(screen.getByRole("button", { name: "Nhập URL PDF" }));
				await user.type(screen.getByLabelText(/URL (tệp )?PDF/), "https://example.org/manual");
			} else {
				const file = new File(["test bytes"], "renamed.pdf", { type: "application/pdf" });
				await user.upload(screen.getByLabelText("Tệp PDF"), file);
			}
			await user.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
			expect(await screen.findByRole("alert")).toHaveTextContent(
				`${message} Cẩm nang gốc · Phiên bản 1`
			);
			expect(screen.getByLabelText(/^Tên tài liệu/)).toHaveValue("Cẩm nang định thêm");
			expect(screen.queryByText("Đã lưu bản nháp riêng tư.")).not.toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Lưu bản nháp" })).toBeDisabled();
			await user.click(screen.getByRole("button", { name: "Mở phiên bản đã có" }));
			const existing = await screen.findByRole("dialog", { name: match.metadata.sourceTitle });
			await user.click(within(existing).getByRole("tab", { name: "Phiên bản" }));
			expect(within(existing).getByLabelText("Lịch sử phiên bản")).toHaveValue(versionId);
			expect(service.detail).toHaveBeenCalledWith(documentId);
		}
	);
	it("shows exact provenance, retained versions and draft-only actions", async () => {
		const panel = await detail();
		expect(panel.getByText("Bản nháp")).toBeInTheDocument();
		expect(panel.queryByText("Thông tin tài liệu và quyền sử dụng")).not.toBeInTheDocument();
		expect(panel.getByRole("button", { name: "Sửa thông tin" })).toBeInTheDocument();
		expect(panel.getByRole("button", { name: "Xuất bản" })).toBeInTheDocument();
		expect(panel.queryByRole("button", { name: "Gửi duyệt" })).not.toBeInTheDocument();
	});
	it("blocks duplicate submissions and waits for server confirmation", async () => {
		let finish!: (value: DocumentDetail) => void;
		vi.mocked(service.action).mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const panel = await detail();
		const button = panel.getByRole("button", { name: "Xuất bản" });
		fireEvent.click(button);
		fireEvent.click(button);
		await waitFor(() => expect(service.action).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(button).toBeDisabled());
		expect(panel.queryByText("Đã xuất bản")).not.toBeInTheDocument();
		finish(doc);
		await waitFor(() => expect(button).not.toBeInTheDocument());
	});
	it("renders stale conflict and reloads authoritative state", async () => {
		vi.mocked(service.action).mockRejectedValue(
			new HttpError("Tài liệu đã thay đổi. Vui lòng tải lại.", 409, {})
		);
		const panel = await detail();
		await userEvent.click(panel.getByRole("button", { name: "Xuất bản" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Tài liệu đã thay đổi");
		await waitFor(() => expect(service.detail).toHaveBeenCalledTimes(2));
	});
	it("publishes an existing draft without sending permission grants", async () => {
		const panel = await detail();
		expect(panel.queryByRole("checkbox")).not.toBeInTheDocument();
		await userEvent.click(panel.getByRole("button", { name: "Xuất bản" }));
		await waitFor(() =>
			expect(service.action).toHaveBeenCalledWith(doc.id, doc.versions[0].id, "publish", {
				expectedRevision: doc.versions[0].revision,
			})
		);
	});
	it("validates minimal draft metadata and rejects invalid locales", () => {
		expect(sourceSchema.safeParse(metadata).success).toBe(true);
		expect(
			sourceSchema.safeParse({
				sourceTitle: metadata.sourceTitle,
				classification: metadata.classification,
				locale: metadata.locale,
			}).success
		).toBe(true);
		expect(sourceSchema.safeParse({ ...metadata, locale: "../../vi" }).success).toBe(false);
	});
});

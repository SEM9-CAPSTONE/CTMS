import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "../../../shared/components/Toast";
import type { ContentVerification, VerificationPosition } from "../content-verification.types";
import { survivalDocumentsService as service } from "../services/survival-documents.service";
import { SourceChunkingStatus, initialRows, tableText } from "./SourceChunkingStatus";

vi.mock("../hooks/useSourceFile", () => ({ useSourceFile: () => ({ file: {} }) }));
vi.mock("../hooks/usePdfDocument", () => ({ usePdfDocument: () => ({ document: {} }) }));
vi.mock("./PdfCanvas", () => ({
	PdfCanvas: ({ page, highlight }: { page: number; highlight: unknown }) => (
		<p>
			Trang đối chiếu {page}
			{highlight ? " · Đã đánh dấu vùng" : ""}
		</p>
	),
}));
const position = (extra: Partial<VerificationPosition> = {}): VerificationPosition => ({
	id: "a".repeat(64),
	page: 17,
	bbox: { l: 20, t: 40, r: 120, b: 60, coord_origin: "TOPLEFT" },
	label: "Chú thích hình",
	kind: "caption",
	originalText: "Phối hợp các ban ngành",
	text: "Phối hợp các ban ngành",
	resolved: false,
	canExclude: false,
	needsVisualCheck: true,
	needsAnchor: false,
	anchors: [],
	...extra,
});
const state = (positions = [position()]): ContentVerification => ({
	extractionId: "set",
	revision: 0,
	available: true,
	preparing: false,
	complete: false,
	positions,
});
function show() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<SourceChunkingStatus documentId="document" versionId="version" current eligible />
		</QueryClientProvider>
	);
}
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
beforeEach(() => {
	vi.spyOn(service, "verification").mockResolvedValue(state());
});

describe("Admin content verification", () => {
	it("shows a specific preparation failure without replacing it with the generic message", async () => {
		const notice = "Thời gian xử lý nội dung đã vượt giới hạn. Hệ thống sẽ tự động thử lại.";
		vi.mocked(service.verification).mockResolvedValue({
			...state([]),
			available: false,
			notice,
			automaticRecoveryPending: true,
		});
		show();
		expect(await screen.findByText(notice)).toBeInTheDocument();
		expect(
			screen.queryByText("Chưa thể chuẩn bị nội dung. Vui lòng kiểm tra lại sau.")
		).not.toBeInTheDocument();
	});
	it("shows a background update without implying the active source is unavailable", async () => {
		vi.mocked(service.verification).mockResolvedValue({
			...state([]),
			inUse: true,
			preparing: true,
			available: false,
			complete: false,
		});
		show();
		expect(
			await screen.findByText("Đang cập nhật nội dung. Tài liệu vẫn sử dụng được.")
		).toBeInTheDocument();
		expect(screen.queryByText("Đang chuẩn bị nội dung, vui lòng chờ…")).not.toBeInTheDocument();
	});
	it("preserves current availability feedback when the background update is interrupted", async () => {
		vi.mocked(service.verification).mockResolvedValue({
			...state([]),
			inUse: true,
			preparing: false,
			available: false,
			complete: false,
		});
		show();
		expect(
			await screen.findByText("Chưa thể cập nhật nội dung. Tài liệu vẫn sử dụng được.")
		).toBeInTheDocument();
		expect(
			screen.queryByText("Chưa thể chuẩn bị nội dung. Vui lòng kiểm tra lại sau.")
		).not.toBeInTheDocument();
	});
	it("keeps the preparation message when no current source is usable", async () => {
		vi.mocked(service.verification).mockResolvedValue({
			...state([]),
			inUse: false,
			preparing: true,
			available: false,
			complete: false,
		});
		show();
		expect(await screen.findByText("Đang chuẩn bị nội dung, vui lòng chờ…")).toBeInTheDocument();
		expect(
			screen.queryByText("Đang cập nhật nội dung. Tài liệu vẫn sử dụng được.")
		).not.toBeInTheDocument();
	});
	it("still asks for unresolved content review when an older same-source generation is usable", async () => {
		vi.mocked(service.verification).mockResolvedValue({ ...state(), inUse: true });
		show();
		expect(await screen.findByRole("button", { name: "Kiểm tra nội dung" })).toBeInTheDocument();
		expect(
			screen.getByText("Có một số nội dung cần kiểm tra trước khi xuất bản.")
		).toBeInTheDocument();
	});
	it("opens the exact source page and region without technical statuses or identifiers", async () => {
		show();
		expect(
			await screen.findByText("Có một số nội dung cần kiểm tra trước khi xuất bản.")
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Kiểm tra nội dung" }));
		expect(screen.getByText("Trang đối chiếu 17 · Đã đánh dấu vùng")).toBeInTheDocument();
		for (const value of ["READY", "NEEDS_REVIEW", "OCR", "embedding", "chunk", "a".repeat(64)])
			expect(screen.queryByText(value)).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/Nhãn này không bổ sung/)).not.toBeInTheDocument();
	});
	it("requires source, context and linked image verification before submitting a correction", async () => {
		const save = vi
			.spyOn(service, "verifyContent")
			.mockResolvedValue(state([position({ resolved: true })]));
		show();
		fireEvent.click(await screen.findByRole("button", { name: "Kiểm tra nội dung" }));
		const submit = screen.getByRole("button", { name: "Lưu xác minh" });
		expect(submit).toBeDisabled();
		fireEvent.change(screen.getByLabelText("Nội dung đối chiếu"), {
			target: { value: "Phối hợp các ban ngành đoàn thể" },
		});
		for (const input of screen.getAllByRole("checkbox")) fireEvent.click(input);
		fireEvent.click(submit);
		await waitFor(() => expect(save).toHaveBeenCalled());
		expect(save.mock.calls[0][3]).toMatchObject({
			action: "correct",
			text: "Phối hợp các ban ngành đoàn thể",
			source_checked: true,
			context_checked: true,
			visual_checked: true,
		});
	});
	it("retains edits after a save failure and reports the failure through the existing toast", async () => {
		vi.spyOn(service, "verifyContent").mockRejectedValue(new Error("network"));
		const error = vi.spyOn(toast, "error");
		show();
		fireEvent.click(await screen.findByRole("button", { name: "Kiểm tra nội dung" }));
		fireEvent.change(screen.getByLabelText("Nội dung đối chiếu"), {
			target: { value: "Nội dung đã đối chiếu" },
		});
		for (const input of screen.getAllByRole("checkbox")) fireEvent.click(input);
		fireEvent.click(screen.getByRole("button", { name: "Lưu xác minh" }));
		await waitFor(() => expect(error).toHaveBeenCalled());
		expect(screen.getByLabelText("Nội dung đối chiếu")).toHaveValue("Nội dung đã đối chiếu");
	});
	it("only offers label exclusion when the server permits it", async () => {
		vi.mocked(service.verification).mockResolvedValue(state([position({ canExclude: true })]));
		show();
		fireEvent.click(await screen.findByRole("button", { name: "Kiểm tra nội dung" }));
		fireEvent.click(screen.getByLabelText(/Nhãn này không bổ sung/));
		expect(screen.getByLabelText("Lý do không sử dụng nhãn")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Lưu xác minh" })).toBeDisabled();
	});
	it("requires a description for visual-only instructions", async () => {
		vi.mocked(service.verification).mockResolvedValue(
			state([position({ kind: "image", label: "Hình ảnh", originalText: "", text: "" })])
		);
		show();
		fireEvent.click(await screen.findByRole("button", { name: "Kiểm tra nội dung" }));
		expect(screen.getByLabelText("Mô tả hình ảnh")).toHaveValue("");
		expect(screen.getByRole("button", { name: "Lưu xác minh" })).toBeDisabled();
	});
	it("preserves table row/column positions including empty cells", () => {
		const p = position({
			kind: "table",
			table: {
				num_rows: 2,
				num_cols: 2,
				table_cells: [
					{
						text: "Vị trí",
						start_row_offset_idx: 0,
						end_row_offset_idx: 1,
						start_col_offset_idx: 0,
						end_col_offset_idx: 1,
					},
					{
						text: "250 ml",
						start_row_offset_idx: 1,
						end_row_offset_idx: 2,
						start_col_offset_idx: 1,
						end_col_offset_idx: 2,
					},
				],
			},
		});
		expect(initialRows(p)).toEqual([
			["Vị trí", ""],
			["", "250 ml"],
		]);
		expect(tableText(initialRows(p))).toContain("|  | 250 ml |");
	});
});

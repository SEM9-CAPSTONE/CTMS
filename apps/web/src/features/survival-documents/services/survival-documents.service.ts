import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { HttpError, httpClient } from "../../../core/api/httpClient";
import type { ContentVerification, VerificationSubmission } from "../content-verification.types";
import type {
	DocumentDetail,
	DocumentListItem,
	EditDraft,
	EditPlan,
	EditorRevision,
	EditorSection,
	SourceAction,
	SourceChunkSet,
	SourceDecision,
	SourceFilters,
	SourceMetadata,
} from "../types";
const endpoints = API_ENDPOINTS.SURVIVAL_DOCUMENTS;
export function sourceActionErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status >= 500) return "Chưa thực hiện được thao tác. Vui lòng thử lại sau.";
		// Keep Vietnamese business explanations; hide transport/framework messages.
		if (/[ăâđêôơư]/iu.test(error.message)) return error.message;
		if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
		if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
		if (error.status === 404) return "Không tìm thấy phiên bản tài liệu. Vui lòng tải lại.";
		if (error.status === 409)
			return "Tài liệu đã thay đổi hoặc nội dung chưa sẵn sàng. Vui lòng tải lại.";
		return "Thông tin thao tác chưa hợp lệ. Vui lòng kiểm tra lại tài liệu.";
	}
	return "Chưa kết nối được dịch vụ. Vui lòng thử lại.";
}
export const survivalDocumentsService = {
	verification: (id: string, versionId: string) =>
		httpClient.get<ContentVerification>(endpoints.VERSION(id, versionId, "content-verification")),
	verifyContent: (id: string, versionId: string, region: string, payload: VerificationSubmission) =>
		httpClient.post<ContentVerification>(
			`${endpoints.VERSION(id, versionId, "content-verification")}/${region}`,
			payload
		),
	list: (filters: SourceFilters) =>
		httpClient.get<{
			items: DocumentListItem[];
			total: number;
			page: number;
			limit: number;
			maxBytes?: number;
		}>(endpoints.ROOT, { ...filters, search: filters.search || undefined }),
	detail: (id: string) => httpClient.get<DocumentDetail>(endpoints.DETAIL(id)),
	startEdit: (id: string, expectedDocumentRevision: number) =>
		httpClient.post<EditDraft>(endpoints.EDIT_DRAFTS(id), { expectedDocumentRevision }),
	editorContent: (id: string, versionId: string) =>
		httpClient.get<EditorSection[]>(endpoints.VERSION(id, versionId, "editor-content")),
	planEdit: (id: string, draftId: string, payload: EditPlan) =>
		httpClient.post<EditDraft>(`${endpoints.EDIT_DRAFT(id, draftId)}/plan`, payload),
	confirmEdit: (id: string, draftId: string, payload: EditorRevision & { reviewBasis: string }) =>
		httpClient.patch<EditDraft>(endpoints.EDIT_DRAFT(id, draftId), payload),
	commitEdit: (id: string, draftId: string, payload: EditorRevision) =>
		httpClient.post<{ document: DocumentDetail; versionId: string }>(
			`${endpoints.EDIT_DRAFT(id, draftId)}/commit`,
			payload
		),
	chunkSets: (id: string, versionId: string) =>
		httpClient.get<SourceChunkSet[]>(endpoints.VERSION(id, versionId, "chunk-sets")),
	remove: (id: string, expectedRevision: number) =>
		httpClient.delete<void>(`${endpoints.DETAIL(id)}?expectedRevision=${expectedRevision}`),
	upload: (metadata: SourceMetadata, file: File, document?: DocumentDetail) => {
		const body = new FormData();
		body.append("file", file);
		body.append("metadata", JSON.stringify(metadata));
		if (document) body.append("expectedDocumentRevision", String(document.revision));
		return httpClient.post<DocumentDetail>(
			document ? endpoints.VERSIONS(document.id) : endpoints.ROOT,
			body
		);
	},
	importUrl: (metadata: SourceMetadata, sourceUrl: string, document?: DocumentDetail) =>
		httpClient.post<DocumentDetail>(
			document ? endpoints.IMPORT_VERSION_URL(document.id) : endpoints.IMPORT_URL,
			{ metadata, sourceUrl, expectedDocumentRevision: document?.revision }
		),
	edit: (id: string, versionId: string, expectedRevision: number, metadata: SourceMetadata) =>
		httpClient.patch<DocumentDetail>(endpoints.VERSION(id, versionId, "metadata"), {
			expectedRevision,
			metadata,
		}),
	action: (id: string, versionId: string, action: SourceAction, payload: SourceDecision) =>
		httpClient.post<DocumentDetail>(endpoints.VERSION(id, versionId, action), payload),
	file: (id: string, versionId: string, signal?: AbortSignal) =>
		httpClient.get<Blob>(endpoints.VERSION(id, versionId, "file"), undefined, {
			responseType: "blob",
			signal,
		}),
};

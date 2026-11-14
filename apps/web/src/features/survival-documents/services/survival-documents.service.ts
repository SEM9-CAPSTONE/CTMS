import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type {
	DocumentDetail,
	DocumentListItem,
	SourceAction,
	SourceChunkSet,
	SourceDecision,
	SourceFilters,
	SourceMetadata,
} from "../types";
const endpoints = API_ENDPOINTS.SURVIVAL_DOCUMENTS;
export const survivalDocumentsService = {
	list: (filters: SourceFilters) =>
		httpClient.get<{
			items: DocumentListItem[];
			total: number;
			page: number;
			limit: number;
			maxBytes?: number;
		}>(endpoints.ROOT, { ...filters, search: filters.search || undefined }),
	detail: (id: string) => httpClient.get<DocumentDetail>(endpoints.DETAIL(id)),
	chunkSets: (id: string, versionId: string) =>
		httpClient.get<SourceChunkSet[]>(endpoints.VERSION(id, versionId, "chunk-sets")),
	retryChunking: (id: string, versionId: string) =>
		httpClient.post<SourceChunkSet>(endpoints.VERSION(id, versionId, "chunk-sets")),
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

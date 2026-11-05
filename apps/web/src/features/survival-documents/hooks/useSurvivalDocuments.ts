import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { SOURCE_STALE_TIME } from "../constants";
import { survivalDocumentsService as service } from "../services/survival-documents.service";
import type {
	DocumentDetail,
	SourceAction,
	SourceDecision,
	SourceFilters,
	SourceMetadata,
} from "../types";

export function useSurvivalDocuments(filters: SourceFilters, id: string | null) {
	const client = useQueryClient();
	const refresh = async () => {
		await Promise.all([
			client.invalidateQueries({ queryKey: queryKeys.survivalDocuments.lists }),
			client.invalidateQueries({ queryKey: queryKeys.survivalDocuments.details }),
		]);
	};
	const save = (data: DocumentDetail) => {
		client.setQueryData(queryKeys.survivalDocuments.detail(data.id), data);
		void refresh();
	};
	const list = useQuery({
		queryKey: queryKeys.survivalDocuments.list(filters),
		queryFn: () => service.list(filters),
		staleTime: SOURCE_STALE_TIME,
	});
	const detail = useQuery({
		queryKey: queryKeys.survivalDocuments.detail(id),
		queryFn: () => {
			if (!id) throw new Error("Chưa chọn tài liệu");
			return service.detail(id);
		},
		enabled: !!id,
		staleTime: SOURCE_STALE_TIME,
	});
	const upload = useMutation({
		mutationFn: ({
			metadata,
			file,
			document,
		}: { metadata: SourceMetadata; file: File; document?: DocumentDetail }) =>
			service.upload(metadata, file, document),
		onSuccess: save,
		onError: refresh,
	});
	const importUrl = useMutation({
		mutationFn: ({
			metadata,
			sourceUrl,
			document,
		}: { metadata: SourceMetadata; sourceUrl: string; document?: DocumentDetail }) =>
			service.importUrl(metadata, sourceUrl, document),
		onSuccess: save,
		onError: refresh,
	});
	const edit = useMutation({
		mutationFn: ({
			documentId,
			versionId,
			revision,
			metadata,
		}: { documentId: string; versionId: string; revision: number; metadata: SourceMetadata }) =>
			service.edit(documentId, versionId, revision, metadata),
		onSuccess: save,
		onError: refresh,
	});
	const action = useMutation({
		mutationFn: ({
			documentId,
			versionId,
			action,
			payload,
		}: { documentId: string; versionId: string; action: SourceAction; payload: SourceDecision }) =>
			service.action(documentId, versionId, action, payload),
		onSuccess: save,
		onError: refresh,
	});
	const remove = useMutation({
		mutationFn: ({
			documentId,
			expectedRevision,
		}: { documentId: string; expectedRevision: number }) =>
			service.remove(documentId, expectedRevision),
		onSuccess: (_, { documentId }) => {
			client.removeQueries({ queryKey: queryKeys.survivalDocuments.detail(documentId) });
			void client.invalidateQueries({ queryKey: queryKeys.survivalDocuments.lists });
		},
		onError: refresh,
	});
	return { list, detail, upload, importUrl, edit, action, remove, refresh };
}

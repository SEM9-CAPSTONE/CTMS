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
		await client.invalidateQueries({ queryKey: queryKeys.survivalDocuments.all });
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
	const references = useQuery({
		queryKey: queryKeys.survivalDocuments.references,
		queryFn: service.references,
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
	return { list, detail, references, upload, edit, action, refresh };
}

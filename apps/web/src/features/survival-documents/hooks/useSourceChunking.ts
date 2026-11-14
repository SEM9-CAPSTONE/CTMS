import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { CHUNK_STATUS_POLL_MS } from "../constants";
import { survivalDocumentsService as service } from "../services/survival-documents.service";

export function useSourceChunking(documentId: string, versionId: string) {
	const client = useQueryClient();
	const queryKey = queryKeys.survivalDocuments.chunkSets(documentId, versionId);
	const query = useQuery({
		queryKey,
		queryFn: () => service.chunkSets(documentId, versionId),
		refetchInterval: ({ state }) => {
			const status = state.data?.[0]?.status;
			return !status || status === "PENDING" || status === "RUNNING" ? CHUNK_STATUS_POLL_MS : false;
		},
	});
	const retry = useMutation({
		mutationFn: () => service.retryChunking(documentId, versionId),
		onSuccess: () => client.invalidateQueries({ queryKey }),
	});
	return { query, retry };
}

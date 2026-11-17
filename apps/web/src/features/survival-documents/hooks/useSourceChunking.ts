import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { CHUNK_STATUS_POLL_MS } from "../constants";
import { survivalDocumentsService as service } from "../services/survival-documents.service";

export function useSourceChunking(documentId: string, versionId: string, enabled: boolean) {
	return useQuery({
		enabled,
		queryKey: queryKeys.survivalDocuments.chunkSets(documentId, versionId),
		queryFn: () => service.chunkSets(documentId, versionId),
		refetchInterval: ({ state }) => {
			const set = state.data?.[0];
			if (set?.status === "FAILED" && set.automatic_recovery_pending) return 60_000;
			return !set || set.status === "PENDING" || set.status === "RUNNING"
				? CHUNK_STATUS_POLL_MS
				: false;
		},
	});
}

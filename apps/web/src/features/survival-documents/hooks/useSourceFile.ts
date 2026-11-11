import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { survivalDocumentsService } from "../services/survival-documents.service";
import { usePdfPreviewUrl } from "./usePdfPreviewUrl";
export function useSourceFile(documentId: string, versionId: string) {
	const file = useQuery({
		queryKey: queryKeys.survivalDocuments.file(documentId, versionId),
		queryFn: ({ signal }) => survivalDocumentsService.file(documentId, versionId, signal),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 0,
		retry: false,
	});
	const url = usePdfPreviewUrl(file.data);
	return { url, file };
}

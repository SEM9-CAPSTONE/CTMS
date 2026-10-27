import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "../../../core/api";
import { restoreDraftImages, tripFormDraftsService } from "../services/trip-form-drafts.service";
export function useTripFormDraft(id?: string) {
	const client = useQueryClient();
	const invalidate = useCallback(
		() => client.invalidateQueries({ queryKey: queryKeys.trips.formDrafts, exact: true }),
		[client]
	);
	const query = useQuery({
		queryKey: queryKeys.trips.formDraft(id ?? "new"),
		queryFn: () => tripFormDraftsService.get(id ?? ""),
		enabled: Boolean(id),
		refetchOnWindowFocus: false,
		refetchOnMount: "always",
		retry: false,
	});
	const images = useMemo(
		() => (query.data ? restoreDraftImages(query.data) : undefined),
		[query.data]
	);
	return {
		invalidate,
		draft: query.data,
		images,
		isLoading: Boolean(id) && query.isPending,
		error: query.error,
		retry: query.refetch,
	};
}

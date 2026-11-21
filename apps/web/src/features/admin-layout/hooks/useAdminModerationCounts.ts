import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "../../../core/api";
import { isAdminUser } from "../../auth/utils/permissions";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { ADMIN_MODERATION_REFRESH_MS, ADMIN_MODERATION_STALE_MS } from "../constants";
import { adminModerationService } from "../services/admin-moderation.service";

export function useAdminModerationCounts() {
	const user = getStoredAuthUser();
	return useQuery({
		queryKey: queryKeys.adminModeration.counts(user?.id ?? ""),
		queryFn: ({ signal }) => adminModerationService.getCounts(signal),
		enabled: Boolean(user?.id) && isAdminUser(user),
		staleTime: ADMIN_MODERATION_STALE_MS,
		refetchInterval: ADMIN_MODERATION_REFRESH_MS,
		refetchOnWindowFocus: true,
		retry: false,
	});
}

export function useRefreshAdminModerationCounts() {
	const client = useQueryClient();
	return useCallback(() => {
		void client.invalidateQueries({ queryKey: queryKeys.adminModeration.all });
	}, [client]);
}

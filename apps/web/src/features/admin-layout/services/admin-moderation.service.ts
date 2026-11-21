import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { AdminModerationCounts } from "../types";

export const adminModerationService = {
	getCounts: (signal: AbortSignal) =>
		httpClient.get<AdminModerationCounts>(API_ENDPOINTS.ADMIN_MODERATION_COUNTS, undefined, {
			signal,
		}),
};

import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CampsiteSearchParams, PaginatedCampsiteSearchResponse } from "../types";

/**
 * CTMS-17-T02. Talks to CTMS-17-T01's frozen `GET /campsites` contract
 * directly -- real server-side `page`/`limit` (unlike admin-audit-logs'
 * client-side-pagination workaround, not needed here since this backend
 * accepts them correctly). `status` is never sent: the backend locks
 * search to `active` campsites structurally in the repository, not via
 * this input, so there is no legal value a client could send to widen it.
 */
export const campsitesService = {
	search: async (params: CampsiteSearchParams): Promise<PaginatedCampsiteSearchResponse> => {
		const cleanParams: Record<string, string | number | boolean | undefined> = {
			province: params.province || undefined,
			city: params.city || undefined,
			// Comma-separated is one of the two shapes SearchCampsitesQueryDto
			// accepts on the backend (toStringArray()) -- used here because
			// httpClient's `params` type doesn't accept arrays.
			amenities:
				params.amenities && params.amenities.length > 0 ? params.amenities.join(",") : undefined,
			minPrice: params.minPrice,
			maxPrice: params.maxPrice,
			page: params.page,
			limit: params.limit,
		};

		return httpClient.get<PaginatedCampsiteSearchResponse>(
			API_ENDPOINTS.CAMPSITES.GET_ALL,
			cleanParams
		);
	},
};

import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CampsiteSearchParams,
	CreateCampsiteInput,
	CreatedCampsite,
	PaginatedCampsiteSearchResponse,
} from "../types";

export const campsitesService = {
	search: async (params: CampsiteSearchParams): Promise<PaginatedCampsiteSearchResponse> => {
		const cleanParams: Record<string, string | number | boolean | undefined> = {
			province: params.province || undefined,
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

	create: async (input: CreateCampsiteInput): Promise<CreatedCampsite> => {
		return httpClient.post<CreatedCampsite>(API_ENDPOINTS.CAMPSITES.CREATE, input);
	},
};

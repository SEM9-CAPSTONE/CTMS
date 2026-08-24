import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CampsiteSearchParams,
	CreateCampsiteInput,
	CreatedCampsite,
	PaginatedCampsiteSearchResponse,
	UpdateCampsiteInput,
} from "../types";

interface CampsiteMediaUploadResponse {
	url: string;
}

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

	getMine: async (): Promise<CreatedCampsite[]> => {
		return httpClient.get<CreatedCampsite[]>(API_ENDPOINTS.CAMPSITES.MY);
	},

	getById: async (id: string): Promise<CreatedCampsite> => {
		const mine = await campsitesService.getMine();
		const campsite = mine.find((item) => item.id === id);

		if (!campsite) {
			throw new Error("Campsite not found in Host ownership list");
		}

		return campsite;
	},

	update: async (id: string, input: UpdateCampsiteInput): Promise<CreatedCampsite> => {
		return httpClient.patch<CreatedCampsite>(API_ENDPOINTS.CAMPSITES.UPDATE(id), input);
	},

	uploadMedia: async (file: File): Promise<CampsiteMediaUploadResponse> => {
		const formData = new FormData();
		formData.append("file", file);

		return httpClient.post<CampsiteMediaUploadResponse>(
			API_ENDPOINTS.CAMPSITES.UPLOAD_MEDIA,
			formData
		);
	},
};

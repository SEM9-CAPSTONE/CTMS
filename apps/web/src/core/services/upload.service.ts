import { API_ENDPOINTS, httpClient } from "../api";

export interface UploadImageResponse {
	url: string;
	key?: string;
}

export const uploadService = {
	uploadImage: async (file: File, folder = "ctms"): Promise<UploadImageResponse> => {
		const formData = new FormData();
		formData.append("file", file);

		return httpClient.post<UploadImageResponse>(
			`${API_ENDPOINTS.UPLOADS.IMAGE}?folder=${encodeURIComponent(folder)}`,
			formData
		);
	},
};

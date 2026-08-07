import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	LoginApiPayload,
	LoginApiResponse,
	RegisterApiPayload,
	RegisterApiResponse,
} from "../types";

export const authService = {
	login: async (payload: LoginApiPayload): Promise<LoginApiResponse> => {
		return httpClient.post<LoginApiResponse>(API_ENDPOINTS.AUTH.LOGIN, payload);
	},

	loginWithGoogle: async (): Promise<{ success: boolean }> => {
		return Promise.resolve({ success: true });
	},

	register: async (payload: RegisterApiPayload): Promise<RegisterApiResponse> => {
		return httpClient.post<RegisterApiResponse>(API_ENDPOINTS.AUTH.REGISTER, payload);
	},
};

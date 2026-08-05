import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { LoginFormData, RegisterApiPayload, RegisterApiResponse } from "../types";

export const authService = {
	login: async (
		data: LoginFormData
	): Promise<{ success: boolean; user: { name: string; email: string } }> => {
		// Service API call handler
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					success: true,
					user: { name: "Người dùng CTMS", email: data.email },
				});
			}, 300);
		});
	},

	loginWithGoogle: async (): Promise<{ success: boolean }> => {
		return Promise.resolve({ success: true });
	},

	register: async (payload: RegisterApiPayload): Promise<RegisterApiResponse> => {
		return httpClient.post<RegisterApiResponse>(API_ENDPOINTS.AUTH.REGISTER, payload);
	},
};

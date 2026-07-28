import type { LoginFormData } from "../types";

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
};

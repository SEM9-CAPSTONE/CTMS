import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { BankAccountItem, CreateBankAccountInput } from "../types";

export const bankAccountService = {
	getAll: async (): Promise<BankAccountItem[]> => {
		return httpClient.get<BankAccountItem[]>(API_ENDPOINTS.BANK_ACCOUNTS.GET_ALL);
	},

	create: async (data: CreateBankAccountInput): Promise<BankAccountItem> => {
		return httpClient.post<BankAccountItem>(API_ENDPOINTS.BANK_ACCOUNTS.CREATE, data);
	},

	delete: async (id: string): Promise<{ success: boolean }> => {
		return httpClient.delete<{ success: boolean }>(API_ENDPOINTS.BANK_ACCOUNTS.DELETE(id));
	},

	setDefault: async (id: string): Promise<BankAccountItem> => {
		return httpClient.patch<BankAccountItem>(API_ENDPOINTS.BANK_ACCOUNTS.SET_DEFAULT(id));
	},
};

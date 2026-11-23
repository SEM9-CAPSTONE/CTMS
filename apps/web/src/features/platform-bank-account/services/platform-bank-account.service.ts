import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	PlatformBankAccount,
	PlatformBankAccountInput,
	PlatformBankAccountResponse,
} from "../types";

export const platformBankAccountService = {
	get: () => httpClient.get<PlatformBankAccountResponse>(API_ENDPOINTS.PLATFORM_BANK_ACCOUNT.ADMIN),
	save: (input: PlatformBankAccountInput) =>
		httpClient.put<PlatformBankAccount>(API_ENDPOINTS.PLATFORM_BANK_ACCOUNT.ADMIN, input),
};

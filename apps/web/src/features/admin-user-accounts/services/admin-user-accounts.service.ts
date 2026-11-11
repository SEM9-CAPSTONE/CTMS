import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AccountStatusActionPayload,
	CurrentUserAccount,
	PaginatedUserAccountsResponse,
	UserAccountDetail,
	UserAccountListParams,
} from "../types";

export const adminUserAccountsService = {
	getCurrentUser: (): Promise<CurrentUserAccount> =>
		httpClient.get<CurrentUserAccount>(API_ENDPOINTS.PROFILE.ME),

	getUsers: (params: UserAccountListParams): Promise<PaginatedUserAccountsResponse> =>
		httpClient.get<PaginatedUserAccountsResponse>(API_ENDPOINTS.USERS.LIST, {
			search: params.search,
			role: params.role,
			status: params.status,
			page: params.page,
			limit: params.limit,
		}),

	getUser: (userId: string): Promise<UserAccountDetail> =>
		httpClient.get<UserAccountDetail>(API_ENDPOINTS.USERS.DETAIL(userId)),

	lockUser: (userId: string, payload: AccountStatusActionPayload): Promise<UserAccountDetail> =>
		httpClient.patch<UserAccountDetail>(API_ENDPOINTS.USERS.LOCK(userId), payload),

	unlockUser: (userId: string, payload: AccountStatusActionPayload): Promise<UserAccountDetail> =>
		httpClient.patch<UserAccountDetail>(API_ENDPOINTS.USERS.UNLOCK(userId), payload),
};

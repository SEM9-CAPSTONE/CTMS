import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminPorterVerificationDetail,
	PaginatedPorterVerifications,
	PorterVerificationListParams,
} from "../types";

export const adminPorterVerificationsService = {
	list: (params: PorterVerificationListParams): Promise<PaginatedPorterVerifications> =>
		httpClient.get<PaginatedPorterVerifications>(API_ENDPOINTS.ADMIN_PORTER_VERIFICATIONS.LIST, {
			status: params.status,
			search: params.search,
			page: params.page,
			limit: params.limit,
		}),

	getDetail: (porterId: string): Promise<AdminPorterVerificationDetail> =>
		httpClient.get<AdminPorterVerificationDetail>(
			API_ENDPOINTS.ADMIN_PORTER_VERIFICATIONS.DETAIL(porterId)
		),

	approve: (porterId: string): Promise<AdminPorterVerificationDetail> =>
		httpClient.patch<AdminPorterVerificationDetail>(
			API_ENDPOINTS.ADMIN_PORTER_VERIFICATIONS.APPROVE(porterId)
		),

	reject: (porterId: string, reason: string): Promise<AdminPorterVerificationDetail> =>
		httpClient.patch<AdminPorterVerificationDetail>(
			API_ENDPOINTS.ADMIN_PORTER_VERIFICATIONS.REJECT(porterId),
			{ reason }
		),
};

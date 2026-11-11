import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ProcessRefundResponse } from "../../booking-refund/types";
import type {
	AdminRefundFilter,
	AdminRefundListResponse,
	ConfirmManualRefundPayload,
	RejectRefundPayload,
} from "../types";

export const adminRefundsService = {
	getRefunds: (filter: AdminRefundFilter): Promise<AdminRefundListResponse> =>
		httpClient.get<AdminRefundListResponse>(API_ENDPOINTS.ADMIN_REFUNDS.LIST, {
			page: filter.page,
			limit: filter.limit,
			status: filter.status,
			search: filter.search,
		}),

	confirmTransfer: (
		obligationId: string,
		payload: ConfirmManualRefundPayload
	): Promise<ProcessRefundResponse> =>
		httpClient.post<ProcessRefundResponse>(
			API_ENDPOINTS.ADMIN_REFUNDS.CONFIRM(obligationId),
			payload
		),

	rejectRefund: (
		obligationId: string,
		payload: RejectRefundPayload
	): Promise<ProcessRefundResponse> =>
		httpClient.post<ProcessRefundResponse>(
			API_ENDPOINTS.ADMIN_REFUNDS.REJECT(obligationId),
			payload
		),
};

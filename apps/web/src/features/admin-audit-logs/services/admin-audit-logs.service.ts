import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { AuditLogListParams, PaginatedAuditLogsResponse } from "../types";

export const adminAuditLogsService = {
	getAuditLogs: (params: AuditLogListParams): Promise<PaginatedAuditLogsResponse> => {
		const cleanParams: Record<string, string | number | boolean | undefined> = {
			page: params.page,
			limit: params.limit,
			actorId: params.actorId || undefined,
			actor: params.actor || undefined,
			action: params.action || undefined,
			targetId: params.targetId || undefined,
			target: params.target || undefined,
			targetType: params.targetType || undefined,
			outcome: params.outcome || undefined,
			startDate: params.startDate || undefined,
			endDate: params.endDate || undefined,
		};
		return httpClient.get<PaginatedAuditLogsResponse>(API_ENDPOINTS.AUDIT_LOGS.LIST, cleanParams);
	},
};

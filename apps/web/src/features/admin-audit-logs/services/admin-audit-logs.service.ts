import { API_ENDPOINTS, httpClient } from "../../../core/api";
import { DEFAULT_AUDIT_LOGS_LIMIT } from "../constants";
import type { AuditLogListParams, PaginatedAuditLogsResponse } from "../types";

export const adminAuditLogsService = {
	getAuditLogs: async (params: AuditLogListParams): Promise<PaginatedAuditLogsResponse> => {
		const cleanParams: Record<string, string | number | boolean | undefined> = {
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

		// Server rejects page/limit via forbidNonWhitelisted on the running build.
		// Workaround: fetch all matching records and slice client-side by page/limit.
		const allData = await httpClient.get<PaginatedAuditLogsResponse>(
			API_ENDPOINTS.AUDIT_LOGS.LIST,
			cleanParams
		);

		const limit = params.limit ?? DEFAULT_AUDIT_LOGS_LIMIT;
		const page = params.page ?? 1;
		const total = allData.items.length;
		const start = (page - 1) * limit;
		const items = allData.items.slice(start, start + limit);

		return {
			items,
			pagination: {
				page,
				limit,
				total,
				totalPages: total === 0 ? 0 : Math.ceil(total / limit),
			},
		};
	},
};

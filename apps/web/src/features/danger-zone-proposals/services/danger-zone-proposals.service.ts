import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ApproveProposalPayload, DangerZoneProposal, ProposalStatusFilter } from "../types";

export const dangerZoneProposalsService = {
	list: (status: ProposalStatusFilter): Promise<DangerZoneProposal[]> =>
		httpClient.get<DangerZoneProposal[]>(
			API_ENDPOINTS.DANGER_ZONE_PROPOSALS.ADMIN_LIST,
			status === "ALL" ? undefined : { status }
		),
	approve: (id: string, payload: ApproveProposalPayload): Promise<DangerZoneProposal> =>
		httpClient.post<DangerZoneProposal>(API_ENDPOINTS.DANGER_ZONE_PROPOSALS.APPROVE(id), payload),
	reject: (id: string, reason: string): Promise<DangerZoneProposal> =>
		httpClient.post<DangerZoneProposal>(API_ENDPOINTS.DANGER_ZONE_PROPOSALS.REJECT(id), {
			reason,
		}),
	listForRoute: (routeId: string): Promise<DangerZoneProposal[]> =>
		httpClient.get<DangerZoneProposal[]>(API_ENDPOINTS.DANGER_ZONE_PROPOSALS.FOR_ROUTE(routeId)),
};

import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	PorterLedTripHistoryResponse,
	PorterProfile,
	PorterRouteQualification,
	UpdatePorterProfileInput,
	UpsertPorterRouteQualificationInput,
} from "../types";

export const porterProfileService = {
	getProfile: (): Promise<PorterProfile> =>
		httpClient.get<PorterProfile>(API_ENDPOINTS.PORTER.PROFILE),

	updateProfile: (input: UpdatePorterProfileInput): Promise<PorterProfile> =>
		httpClient.patch<PorterProfile>(API_ENDPOINTS.PORTER.PROFILE, input),

	getLedTripHistory: (page: number, limit: number): Promise<PorterLedTripHistoryResponse> => {
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		return httpClient.get<PorterLedTripHistoryResponse>(
			`${API_ENDPOINTS.PORTER.LED_TRIPS}?${params.toString()}`
		);
	},

	getMyRouteQualifications: (): Promise<PorterRouteQualification[]> =>
		httpClient.get<PorterRouteQualification[]>(API_ENDPOINTS.PORTER.ROUTE_QUALIFICATIONS),

	upsertRouteQualification: (
		routeId: string,
		input: UpsertPorterRouteQualificationInput
	): Promise<PorterRouteQualification> =>
		httpClient.put<PorterRouteQualification>(
			API_ENDPOINTS.PORTER.ROUTE_QUALIFICATION_BY_ROUTE(routeId),
			input
		),
};

import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	PorterProfile,
	PorterRouteQualification,
	RoutePorterQualification,
	UpdatePorterProfileInput,
	UpsertPorterRouteQualificationInput,
	VerifyPorterRouteQualificationInput,
} from "../types";

export const porterProfileService = {
	getProfile: (): Promise<PorterProfile> =>
		httpClient.get<PorterProfile>(API_ENDPOINTS.PORTER.PROFILE),

	updateProfile: (input: UpdatePorterProfileInput): Promise<PorterProfile> =>
		httpClient.patch<PorterProfile>(API_ENDPOINTS.PORTER.PROFILE, input),

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

	getRoutePorterQualifications: (routeId: string): Promise<RoutePorterQualification[]> =>
		httpClient.get<RoutePorterQualification[]>(
			API_ENDPOINTS.PORTER.ROUTE_PORTER_QUALIFICATIONS(routeId)
		),

	verifyRouteQualification: (
		qualificationId: string,
		input: VerifyPorterRouteQualificationInput
	): Promise<PorterRouteQualification> =>
		httpClient.patch<PorterRouteQualification>(
			API_ENDPOINTS.PORTER.VERIFY_QUALIFICATION(qualificationId),
			input
		),
};

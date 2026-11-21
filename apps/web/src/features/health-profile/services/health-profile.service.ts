import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type { HealthProfileFormValues } from "../schema/health-profile.schema";
import type { HealthProfileData } from "../types";

/** Use the authenticated Camper's persisted profile directly; never substitute local health data. */
export const healthProfileService = {
	getHealthProfile: (): Promise<HealthProfileData> =>
		httpClient.get<HealthProfileData>(API_ENDPOINTS.HEALTH_PROFILE.GET),
	updateHealthProfile: (
		values: HealthProfileFormValues,
		version: number
	): Promise<HealthProfileData> =>
		httpClient.put<HealthProfileData>(API_ENDPOINTS.HEALTH_PROFILE.UPDATE, values, {
			params: { version },
		}),
	revokeConsent: (): Promise<HealthProfileData> =>
		httpClient.post<HealthProfileData>(API_ENDPOINTS.HEALTH_PROFILE.REVOKE_CONSENT),
	grantConsent: (): Promise<HealthProfileData> =>
		httpClient.post<HealthProfileData>(API_ENDPOINTS.HEALTH_PROFILE.GRANT_CONSENT),
};

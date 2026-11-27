import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AcceptTermsPayload,
	AcceptTermsResponse,
	CreateTermsVersionPayload,
	MyTermsStatus,
	TermsVersionDetail,
	TermsVersionSummary,
	UpdateTermsVersionPayload,
} from "../types";

export const termsService = {
	getCurrent: async (): Promise<TermsVersionDetail> => {
		return httpClient.get<TermsVersionDetail>(API_ENDPOINTS.TERMS.CURRENT);
	},

	listVersions: async (): Promise<TermsVersionSummary[]> => {
		return httpClient.get<TermsVersionSummary[]>(API_ENDPOINTS.TERMS.VERSIONS);
	},

	getVersionByCode: async (version: string): Promise<TermsVersionDetail> => {
		return httpClient.get<TermsVersionDetail>(API_ENDPOINTS.TERMS.VERSION_BY_CODE(version));
	},

	getMyStatus: async (): Promise<MyTermsStatus> => {
		return httpClient.get<MyTermsStatus>(API_ENDPOINTS.TERMS.MY_STATUS);
	},

	acceptTerms: async (payload: AcceptTermsPayload): Promise<AcceptTermsResponse> => {
		return httpClient.post<AcceptTermsResponse>(API_ENDPOINTS.TERMS.ACCEPT, payload);
	},

	publishVersion: async (payload: CreateTermsVersionPayload): Promise<TermsVersionDetail> => {
		return httpClient.post<TermsVersionDetail>(API_ENDPOINTS.TERMS.ADMIN_PUBLISH_VERSION, payload);
	},

	updateVersion: async (
		id: string,
		payload: UpdateTermsVersionPayload
	): Promise<TermsVersionDetail> => {
		return httpClient.patch<TermsVersionDetail>(
			API_ENDPOINTS.TERMS.ADMIN_UPDATE_VERSION(id),
			payload
		);
	},
};

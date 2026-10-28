import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CreateRequestInput,
	LevelNotification,
	OwnQualification,
	RequestDetail,
	RequestEvidence,
	RequestFilters,
	RequestList,
	RequestReviewInput,
} from "../request-types";
const api = API_ENDPOINTS.PORTER_LEVEL_REQUESTS;
export const levelRequestsService = {
	list: (admin: boolean, filters: RequestFilters) =>
		httpClient.get<RequestList>(admin ? api.ADMIN : api.MINE, { ...filters, limit: 20 }),
	detail: (admin: boolean, id: string) => httpClient.get<RequestDetail>(api.DETAIL(admin, id)),
	qualifications: () =>
		httpClient.get<OwnQualification[]>(API_ENDPOINTS.PORTER_LEVELS.MY_QUALIFICATIONS),
	create: (input: CreateRequestInput) => {
		const form = new FormData();
		form.set("routeId", input.routeId);
		form.set("targetLevel", input.targetLevel);
		form.set("reason", input.reason);
		form.set("expectedQualificationVersion", String(input.expectedQualificationVersion));
		for (const file of input.files) form.append("files", file);
		return httpClient.post(api.MINE, form);
	},
	review: (id: string, input: RequestReviewInput) => {
		const { action, ...body } = input;
		return httpClient.post(api.ACTION(true, id, action), body);
	},
	cancel: (id: string, expectedVersion: number) =>
		httpClient.post(api.ACTION(false, id, "cancel"), { expectedVersion }),
	resubmit: (id: string, expectedVersion: number, reason: string) =>
		httpClient.post(api.ACTION(false, id, "resubmit"), { expectedVersion, reason }),
	addEvidence: (id: string, expectedVersion: number, files: File[]) => {
		const form = new FormData();
		form.set("expectedVersion", String(expectedVersion));
		for (const file of files) form.append("files", file);
		return httpClient.post(api.ACTION(false, id, "evidence"), form);
	},
	removeEvidence: (id: string, fileId: string, expectedVersion: number) =>
		httpClient.delete(api.EVIDENCE(false, id, fileId), { body: { expectedVersion } }),
	download: (admin: boolean, id: string, file: RequestEvidence) =>
		httpClient.get<Blob>(api.EVIDENCE(admin, id, file.id), undefined, { responseType: "blob" }),
	notifications: () => httpClient.get<LevelNotification[]>(api.NOTIFICATIONS),
	readNotification: (id: string) => httpClient.post(api.NOTIFICATION_READ(id)),
};

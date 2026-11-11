import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AssignIncidentPayload,
	IncidentAction,
	ReportIncidentPayload,
	ReportIncidentResult,
	TripIncident,
	TripIncidentList,
	UpdateIncidentStatusPayload,
} from "../types";

export interface IncidentActionListResponse {
	items: IncidentAction[];
}

export interface TripIncidentsSyncApi {
	report: (tripId: string, payload: ReportIncidentPayload) => Promise<ReportIncidentResult>;
	list: (tripId: string) => Promise<TripIncidentList>;
	uploadMedia: (tripId: string, incidentId: string, photo: Blob) => Promise<TripIncident>;
}

export interface TripIncidentsApi extends TripIncidentsSyncApi {
	assign: (
		tripId: string,
		incidentId: string,
		payload: AssignIncidentPayload
	) => Promise<TripIncident>;
	updateStatus: (
		tripId: string,
		incidentId: string,
		payload: UpdateIncidentStatusPayload
	) => Promise<TripIncident>;
	listHistory: (tripId: string, incidentId: string) => Promise<IncidentActionListResponse>;
}

export const tripIncidentsService: TripIncidentsApi = {
	report: (tripId, payload) =>
		httpClient.post<ReportIncidentResult>(API_ENDPOINTS.TRIPS.INCIDENTS(tripId), payload),
	list: (tripId) => httpClient.get<TripIncidentList>(API_ENDPOINTS.TRIPS.INCIDENTS(tripId)),
	uploadMedia: (tripId, incidentId, photo) => {
		const form = new FormData();
		form.append("file", photo);
		return httpClient.put<TripIncident>(
			API_ENDPOINTS.TRIPS.INCIDENT_MEDIA(tripId, incidentId),
			form
		);
	},
	assign: (tripId, incidentId, payload) =>
		httpClient.patch<TripIncident>(
			API_ENDPOINTS.TRIPS.INCIDENT_ASSIGN(tripId, incidentId),
			payload
		),
	updateStatus: (tripId, incidentId, payload) =>
		httpClient.patch<TripIncident>(
			API_ENDPOINTS.TRIPS.INCIDENT_STATUS(tripId, incidentId),
			payload
		),
	listHistory: (tripId, incidentId) =>
		httpClient.get<IncidentActionListResponse>(
			API_ENDPOINTS.TRIPS.INCIDENT_HISTORY(tripId, incidentId)
		),
};

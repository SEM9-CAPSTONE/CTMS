import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	ReportIncidentPayload,
	ReportIncidentResult,
	TripIncident,
	TripIncidentList,
} from "../types";

export interface TripIncidentsApi {
	report: (tripId: string, payload: ReportIncidentPayload) => Promise<ReportIncidentResult>;
	list: (tripId: string) => Promise<TripIncidentList>;
	uploadMedia: (tripId: string, incidentId: string, photo: Blob) => Promise<TripIncident>;
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
};

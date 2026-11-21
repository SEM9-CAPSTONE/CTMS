import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ActiveTripMap, MapParticipant, ParticipantSelection } from "../types/active-trip-map";
import type { TripAlertsResponse } from "../types/trip-alert";

export const activeTripMapService = {
	async monitoring(tripId: string, signal: AbortSignal) {
		// Publish both reads together; an alert failure must not hide available positions.
		const [maps, alerts] = await Promise.allSettled([
			activeTripMapService.list(signal),
			httpClient.get<TripAlertsResponse>(API_ENDPOINTS.HOST_MONITORING.ALERTS(tripId), undefined, {
				signal,
			}),
		]);
		if (maps.status === "rejected") throw maps.reason;
		return {
			...maps.value,
			alerts: alerts.status === "fulfilled" ? alerts.value : undefined,
			alertError: alerts.status === "rejected" ? (alerts.reason as unknown) : undefined,
			refreshedAt: Date.now(),
		};
	},
	async list(signal: AbortSignal) {
		const items: ActiveTripMap[] = [];
		let freshnessMaxAgeSeconds = 0;
		const limit = 20;
		for (let page = 1; ; page++) {
			const result = await httpClient.get<{
				items: ActiveTripMap[];
				total: number;
				freshnessMaxAgeSeconds: number;
			}>(API_ENDPOINTS.HOST_MONITORING.ACTIVE_TRIPS, { page, limit }, { signal });
			freshnessMaxAgeSeconds = result.freshnessMaxAgeSeconds;
			items.push(...result.items);
			if (page * limit >= result.total || result.items.length === 0)
				return { items, freshnessMaxAgeSeconds };
		}
	},
	participant(selection: ParticipantSelection, signal: AbortSignal) {
		return httpClient.get<{ participant: MapParticipant; freshnessMaxAgeSeconds: number }>(
			API_ENDPOINTS.HOST_MONITORING.PARTICIPANT(
				selection.tripId,
				selection.role,
				selection.participantId
			),
			undefined,
			{ signal }
		);
	},
};

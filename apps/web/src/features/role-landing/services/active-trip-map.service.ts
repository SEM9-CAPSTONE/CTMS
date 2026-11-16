import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ActiveTripMap, MapParticipant, ParticipantSelection } from "../types/active-trip-map";

export const activeTripMapService = {
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

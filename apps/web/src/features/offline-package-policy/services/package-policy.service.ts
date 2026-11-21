import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type { TripDetails } from "../../trips/types";
import type { DepartureNotice } from "../types";

export const packagePolicyService = {
	status: (trip: string, signal?: AbortSignal) =>
		httpClient.get<{ blocked: boolean; reasonCode: string | null; tripStatus?: string }>(
			`/trips/${trip}/offline-package-policy/departure-status`,
			undefined,
			{ signal }
		),
	list: async (signal?: AbortSignal): Promise<DepartureNotice[]> => {
		const notices = await httpClient.get<DepartureNotice[]>(
			API_ENDPOINTS.PACKAGE_DEPARTURE_NOTIFICATIONS.LIST,
			undefined,
			{ signal }
		);
		const summaries = new Map(
			await Promise.all(
				[...new Set(notices.map((item) => item.tripId))].map(async (id) => {
					const [trip, state] = await Promise.all([
						httpClient.get<TripDetails>(`/trips/${id}`, undefined, { signal }),
						packagePolicyService.status(id, signal),
					]);
					return [id, { trip, state }] as const;
				})
			)
		);
		return notices.map((item) => {
			const summary = summaries.get(item.tripId);
			if (!summary) throw new Error("Departure notice Trip context is unavailable");
			const resolved = ["cancelled", "completed"].includes(summary.trip.status);
			return {
				...item,
				tripTitle: summary.trip.title,
				startsAt: summary.trip.startsAt,
				resolved,
				active: !resolved && summary.state.blocked && item.active,
			};
		});
	},
	read: (id: string) => httpClient.post(API_ENDPOINTS.PACKAGE_DEPARTURE_NOTIFICATIONS.READ(id), {}),
};

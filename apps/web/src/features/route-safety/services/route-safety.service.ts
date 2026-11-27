import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { GeoJsonLineString } from "../../trekking-routes/types";
import type {
	MapSafetyBounds,
	RouteSafetyResult,
	SafetyProvider,
	VerifiedZoneCollection,
} from "../types";

export const routeSafetyService = {
	review: (routeId: string, source: SafetyProvider, signal?: AbortSignal) =>
		httpClient.get<RouteSafetyResult>(
			API_ENDPOINTS.ROUTE_SAFETY.REVIEW(routeId),
			{ source },
			{ signal }
		),
	verifiedZones: (bounds: MapSafetyBounds, signal?: AbortSignal): Promise<VerifiedZoneCollection> =>
		httpClient.get<VerifiedZoneCollection>(
			API_ENDPOINTS.ROUTE_SAFETY.VERIFIED_ZONES,
			{ ...bounds },
			{ signal }
		),
	analyze: (
		geometry: GeoJsonLineString,
		routeId?: string,
		signal?: AbortSignal,
		source?: SafetyProvider
	): Promise<RouteSafetyResult> =>
		httpClient.post<RouteSafetyResult>(
			API_ENDPOINTS.ROUTE_SAFETY.ANALYZE,
			{ geometry, ...(routeId ? { routeId } : {}), ...(source ? { source } : {}) },
			{ signal }
		),
};

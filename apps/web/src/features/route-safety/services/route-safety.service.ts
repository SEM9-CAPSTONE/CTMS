import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { GeoJsonLineString } from "../../trekking-routes/types";
import type { RouteSafetyResult, SafetyProvider } from "../types";

export const routeSafetyService = {
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

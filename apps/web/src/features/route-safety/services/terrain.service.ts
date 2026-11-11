import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { GeoJsonLineString } from "../../trekking-routes/types";
import type { TerrainResult } from "../terrain-types";

export const terrainService = {
	analyze: (geometry: GeoJsonLineString, signal?: AbortSignal): Promise<TerrainResult> =>
		httpClient.post<TerrainResult>(API_ENDPOINTS.ROUTE_SAFETY.TERRAIN, { geometry }, { signal }),
};

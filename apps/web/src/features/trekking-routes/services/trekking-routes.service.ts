import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CreateTrekkingRouteInput, CreatedTrekkingRoute } from "../types";

export const trekkingRoutesService = {
	listByCampsite: (campsiteId: string): Promise<CreatedTrekkingRoute[]> =>
		httpClient.get<CreatedTrekkingRoute[]>(API_ENDPOINTS.TREKKING.ROUTES, { campsiteId }),
	create: (input: CreateTrekkingRouteInput): Promise<CreatedTrekkingRoute> =>
		httpClient.post<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.ROUTES, input),
};

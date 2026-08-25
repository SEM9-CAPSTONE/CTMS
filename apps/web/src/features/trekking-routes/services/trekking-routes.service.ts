import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CreateCheckpointInput,
	CreateTrekkingRouteInput,
	CreatedTrekkingRoute,
	RouteCheckpoint,
} from "../types";

export const trekkingRoutesService = {
	listByCampsite: (campsiteId: string): Promise<CreatedTrekkingRoute[]> =>
		httpClient.get<CreatedTrekkingRoute[]>(API_ENDPOINTS.TREKKING.ROUTES, { campsiteId }),
	create: (input: CreateTrekkingRouteInput): Promise<CreatedTrekkingRoute> =>
		httpClient.post<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.ROUTES, input),
	listCheckpoints: (routeId: string): Promise<RouteCheckpoint[]> =>
		httpClient.get<RouteCheckpoint[]>(API_ENDPOINTS.TREKKING.CHECKPOINTS(routeId)),
	createCheckpoint: (routeId: string, input: CreateCheckpointInput): Promise<RouteCheckpoint> =>
		httpClient.post<RouteCheckpoint>(API_ENDPOINTS.TREKKING.CHECKPOINTS(routeId), input),
};

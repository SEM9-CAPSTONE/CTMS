import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminTrekkingRouteReview,
	CreateCheckpointInput,
	CreateTrekkingRouteInput,
	CreatedTrekkingRoute,
	ReviewTrekkingRouteInput,
	RouteCheckpoint,
} from "../types";

export const trekkingRoutesService = {
	listPendingReview: (): Promise<AdminTrekkingRouteReview[]> =>
		httpClient.get<AdminTrekkingRouteReview[]>(API_ENDPOINTS.TREKKING.PENDING_REVIEW),
	review: (routeId: string, input: ReviewTrekkingRouteInput): Promise<AdminTrekkingRouteReview> =>
		httpClient.patch<AdminTrekkingRouteReview>(API_ENDPOINTS.TREKKING.REVIEW(routeId), input),
	listByCampsite: (campsiteId: string): Promise<CreatedTrekkingRoute[]> =>
		httpClient.get<CreatedTrekkingRoute[]>(API_ENDPOINTS.TREKKING.ROUTES, { campsiteId }),
	create: (input: CreateTrekkingRouteInput): Promise<CreatedTrekkingRoute> =>
		httpClient.post<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.ROUTES, input),
	listCheckpoints: (routeId: string): Promise<RouteCheckpoint[]> =>
		httpClient.get<RouteCheckpoint[]>(API_ENDPOINTS.TREKKING.CHECKPOINTS(routeId)),
	createCheckpoint: (routeId: string, input: CreateCheckpointInput): Promise<RouteCheckpoint> =>
		httpClient.post<RouteCheckpoint>(API_ENDPOINTS.TREKKING.CHECKPOINTS(routeId), input),
};

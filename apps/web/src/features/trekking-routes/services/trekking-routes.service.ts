import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminTrekkingRouteReview,
	CreateCheckpointInput,
	CreateRouteDangerZoneInput,
	CreateTrekkingRouteInput,
	CreatedTrekkingRoute,
	ReviewTrekkingRouteInput,
	RouteCheckpoint,
	RouteDangerZone,
	RouteStatusReasonInput,
	UpdateCheckpointInput,
} from "../types";

export const trekkingRoutesService = {
	listPendingReview: (): Promise<AdminTrekkingRouteReview[]> =>
		httpClient.get<AdminTrekkingRouteReview[]>(API_ENDPOINTS.TREKKING.PENDING_REVIEW),
	review: (routeId: string, input: ReviewTrekkingRouteInput): Promise<AdminTrekkingRouteReview> =>
		httpClient.patch<AdminTrekkingRouteReview>(API_ENDPOINTS.TREKKING.REVIEW(routeId), input),
	listMine: (): Promise<CreatedTrekkingRoute[]> =>
		httpClient.get<CreatedTrekkingRoute[]>(API_ENDPOINTS.TREKKING.ROUTES),
	create: (input: CreateTrekkingRouteInput): Promise<CreatedTrekkingRoute> =>
		httpClient.post<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.ROUTES, input),
	updateDraft: (routeId: string, input: CreateTrekkingRouteInput): Promise<CreatedTrekkingRoute> =>
		httpClient.patch<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.ROUTE_BY_ID(routeId), input),
	submitForApproval: (routeId: string): Promise<CreatedTrekkingRoute> =>
		httpClient.patch<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.SUBMIT_FOR_APPROVAL(routeId)),
	close: (routeId: string, input: RouteStatusReasonInput): Promise<CreatedTrekkingRoute> =>
		httpClient.patch<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.CLOSE_ROUTE(routeId), input),
	reopen: (routeId: string, input: RouteStatusReasonInput): Promise<CreatedTrekkingRoute> =>
		httpClient.patch<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.REOPEN_ROUTE(routeId), input),
	listCheckpoints: (routeId: string): Promise<RouteCheckpoint[]> =>
		httpClient.get<RouteCheckpoint[]>(API_ENDPOINTS.TREKKING.CHECKPOINTS(routeId)),
	createCheckpoint: (routeId: string, input: CreateCheckpointInput): Promise<RouteCheckpoint> =>
		httpClient.post<RouteCheckpoint>(API_ENDPOINTS.TREKKING.CHECKPOINTS(routeId), input),
	updateCheckpoint: (
		routeId: string,
		checkpointId: string,
		input: UpdateCheckpointInput
	): Promise<RouteCheckpoint> =>
		httpClient.patch<RouteCheckpoint>(
			API_ENDPOINTS.TREKKING.CHECKPOINT(routeId, checkpointId),
			input
		),
	listRouteDangerZones: (routeId: string): Promise<RouteDangerZone[]> =>
		httpClient.get<RouteDangerZone[]>(API_ENDPOINTS.TREKKING.HAZARD_AREAS(routeId)),
	createRouteDangerZone: (
		routeId: string,
		input: CreateRouteDangerZoneInput
	): Promise<RouteDangerZone> =>
		httpClient.post<RouteDangerZone>(API_ENDPOINTS.TREKKING.HAZARD_AREAS(routeId), input),
};

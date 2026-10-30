import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminRouteReviewsQuery,
	AdminTrekkingRouteReview,
	CreateCheckpointInput,
	CreateRouteDangerZoneInput,
	CreateTrekkingRouteInput,
	CreatedTrekkingRoute,
	PaginatedAdminRouteReviews,
	PaginatedTrekkingRoutesResponse,
	ReviewTrekkingRouteInput,
	RouteCheckpoint,
	RouteDangerZone,
	RouteListFilters,
	RouteStatusFilter,
	RouteStatusReasonInput,
	UpdateCheckpointInput,
} from "../types";

export const trekkingRoutesService = {
	getRouteSafety: async (routeId: string) => {
		const [checkpoints, dangerZones] = await Promise.all([
			trekkingRoutesService.listCheckpoints(routeId),
			trekkingRoutesService.listRouteDangerZones(routeId),
		]);
		return {
			checkpoints: checkpoints.sort((a, b) => a.routePosition - b.routePosition),
			dangerZones,
		};
	},
	listPendingReview: (): Promise<AdminTrekkingRouteReview[]> =>
		httpClient.get<AdminTrekkingRouteReview[]>(API_ENDPOINTS.TREKKING.PENDING_REVIEW),
	listAdminReviews: (query: AdminRouteReviewsQuery): Promise<PaginatedAdminRouteReviews> =>
		httpClient.get<PaginatedAdminRouteReviews>(API_ENDPOINTS.TREKKING.ADMIN_REVIEWS, {
			reviewOutcome: query.reviewOutcome,
			page: query.page,
			limit: query.limit,
		}),
	review: (routeId: string, input: ReviewTrekkingRouteInput): Promise<AdminTrekkingRouteReview> =>
		httpClient.patch<AdminTrekkingRouteReview>(API_ENDPOINTS.TREKKING.REVIEW(routeId), input),
	listMine: (): Promise<CreatedTrekkingRoute[]> =>
		httpClient.get<CreatedTrekkingRoute[]>(API_ENDPOINTS.TREKKING.ROUTES),
	listMinePaginated: (
		page = 1,
		limit = 20,
		status: RouteStatusFilter = "all",
		filters?: RouteListFilters
	): Promise<PaginatedTrekkingRoutesResponse> =>
		httpClient.get<PaginatedTrekkingRoutesResponse>(API_ENDPOINTS.TREKKING.PAGINATED_ROUTES, {
			page,
			limit,
			status,
			...filters,
		}),
	getMineById: (routeId: string): Promise<CreatedTrekkingRoute> =>
		httpClient.get<CreatedTrekkingRoute>(API_ENDPOINTS.TREKKING.ROUTE_BY_ID(routeId)),
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

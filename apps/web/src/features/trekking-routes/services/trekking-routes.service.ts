import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminTrekkingRouteReview,
	CreateCheckpointInput,
	CreateTrekkingRouteInput,
	CreatedTrekkingRoute,
	ReviewTrekkingRouteInput,
	RouteCheckpoint,
	RouteStatusReasonInput,
	WeatherRiskAssessment,
	WeatherSnapshot,
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
	// The backend sends a genuinely empty body (Content-Length: 0), not the
	// JSON string "{}", for a route with no weather history yet --
	// httpClient maps that to `undefined` (verified against a real response,
	// not assumed).
	getLatestWeather: async (routeId: string): Promise<WeatherSnapshot | null> => {
		const result = await httpClient.get<WeatherSnapshot | undefined>(
			API_ENDPOINTS.TREKKING.WEATHER_LATEST(routeId)
		);
		return result ?? null;
	},
	refreshWeather: (routeId: string): Promise<WeatherSnapshot> =>
		httpClient.post<WeatherSnapshot>(API_ENDPOINTS.TREKKING.WEATHER_REFRESH(routeId)),
	getLatestWeatherRisk: async (routeId: string): Promise<WeatherRiskAssessment | null> => {
		const result = await httpClient.get<WeatherRiskAssessment | undefined>(
			API_ENDPOINTS.TREKKING.WEATHER_RISK_LATEST(routeId)
		);
		return result ?? null;
	},
	calculateWeatherRisk: (routeId: string): Promise<WeatherRiskAssessment> =>
		httpClient.post<WeatherRiskAssessment>(API_ENDPOINTS.TREKKING.WEATHER_RISK_CALCULATE(routeId)),
};

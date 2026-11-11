import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { ScheduleProgressResponse } from "../types";

export interface ScheduleProgressService {
	get(tripId: string): Promise<ScheduleProgressResponse>;
}

export const scheduleProgressService: ScheduleProgressService = {
	get: (tripId) =>
		httpClient.get<ScheduleProgressResponse>(API_ENDPOINTS.TRIPS.SCHEDULE_PROGRESS(tripId)),
};

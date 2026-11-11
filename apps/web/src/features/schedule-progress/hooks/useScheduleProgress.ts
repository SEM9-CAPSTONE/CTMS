import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import {
	type ScheduleProgressService,
	scheduleProgressService,
} from "../services/schedule-progress.service";

/** Approved refresh cadence: breadcrumbs are logged every 30 s and thresholds are in minutes. */
export const SCHEDULE_PROGRESS_REFRESH_MS = 60_000;

export function useScheduleProgress(
	tripId: string,
	service: ScheduleProgressService = scheduleProgressService
) {
	return useQuery({
		queryKey: queryKeys.trips.scheduleProgress(tripId),
		queryFn: () => service.get(tripId),
		refetchInterval: SCHEDULE_PROGRESS_REFRESH_MS,
		retry: false,
	});
}

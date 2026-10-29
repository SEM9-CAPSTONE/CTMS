import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { queryKeys } from "../../../core/api/queryKeys";
import {
	OVERVIEW_CLOCK_MS,
	OVERVIEW_DISPLAY_STALE_MS,
	OVERVIEW_PAGE_SIZE,
	OVERVIEW_REFRESH_MS,
	OVERVIEW_STALE_TIME_MS,
} from "../constants";
import { hostOverviewService } from "../services/host-overview.service";

export const isOverviewRestricted = (error: unknown) =>
	error instanceof HttpError && (error.status === 401 || error.status === 403);

export function useHostOverview(hostId: string, page: number, enabled = true) {
	const query = useQuery({
		queryKey: queryKeys.hostOverview.page(hostId, page, OVERVIEW_PAGE_SIZE),
		queryFn: ({ signal }) => hostOverviewService.get(page, OVERVIEW_PAGE_SIZE, signal),
		enabled: Boolean(hostId) && enabled,
		retry: false,
		staleTime: OVERVIEW_STALE_TIME_MS,
		refetchInterval: (current) =>
			!enabled || isOverviewRestricted(current.state.error) ? false : OVERVIEW_REFRESH_MS,
	});
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), OVERVIEW_CLOCK_MS);
		return () => window.clearInterval(timer);
	}, []);
	const restricted = isOverviewRestricted(query.error);
	const data = restricted ? undefined : query.data;
	const stale = Boolean(
		data &&
			(query.isRefetchError || now - Date.parse(data.generatedAt) >= OVERVIEW_DISPLAY_STALE_MS)
	);
	return { ...query, data, restricted, stale };
}

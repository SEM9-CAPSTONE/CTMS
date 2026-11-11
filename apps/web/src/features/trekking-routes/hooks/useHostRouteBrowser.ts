import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { HttpError } from "../../../core/api";
import { queryKeys } from "../../../core/api/queryKeys";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { HOST_ROUTE_PAGE_SIZE, HOST_ROUTE_SEARCH_DELAY_MS } from "../constants";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { RouteSort, RouteStatusFilter } from "../types";

export function useHostRouteBrowser() {
	const hostId = getStoredAuthUser()?.id ?? "";
	const [page, setPage] = useState(1);
	const [statusFilter, setStatus] = useState<RouteStatusFilter>("all");
	const [search, setSearch] = useState("");
	const [stableSearch, setStableSearch] = useState("");
	const [sort, setOrder] = useState<RouteSort>("newest");
	useEffect(() => {
		if (search.trim() === stableSearch) return;
		const timer = window.setTimeout(() => {
			setStableSearch(search.trim());
			setPage(1);
		}, HOST_ROUTE_SEARCH_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [search, stableSearch]);
	const query = useQuery({
		queryKey: queryKeys.trekking.hostList(hostId, {
			page,
			limit: HOST_ROUTE_PAGE_SIZE,
			status: statusFilter,
			search: stableSearch,
			sort,
		}),
		queryFn: () =>
			trekkingRoutesService.listMinePaginated(page, HOST_ROUTE_PAGE_SIZE, statusFilter, {
				search: stableSearch,
				sort,
			}),
		enabled: Boolean(hostId),
		staleTime: 0,
		retry: false,
	});
	const totalPages = query.data?.pagination.totalPages;
	useEffect(() => {
		if (totalPages !== undefined && page > Math.max(1, totalPages))
			setPage(Math.max(1, totalPages));
	}, [page, totalPages]);
	const setStatusFilter = useCallback((status: RouteStatusFilter) => {
		setStatus(status);
		setPage(1);
	}, []);
	const setSort = useCallback((value: RouteSort) => {
		setOrder(value);
		setPage(1);
	}, []);
	const error = query.isError
		? query.error instanceof HttpError && query.error.status === 403
			? "Bạn không có quyền xem tuyến đường."
			: "Không thể tải danh sách tuyến đường. Vui lòng thử lại."
		: "";
	return {
		items: query.data?.items ?? [],
		pagination: query.data?.pagination ?? {
			page,
			limit: HOST_ROUTE_PAGE_SIZE,
			total: 0,
			totalPages: 0,
		},
		statusCounts: query.data?.statusCounts,
		statusFilter,
		search,
		sort,
		isLoading: query.isPending && Boolean(hostId),
		error,
		setPage,
		setStatusFilter,
		setSearch,
		setSort,
		retry: async () => {
			await query.refetch();
		},
	};
}

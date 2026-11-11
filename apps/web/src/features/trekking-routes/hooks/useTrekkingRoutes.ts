import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute, RouteStatusFilter, TrekkingRoutesPagination } from "../types";

const ROUTES_PAGE_SIZE = 20;

function listErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem tuyến đường.";
	}
	return "Không thể tải danh sách tuyến đường. Vui lòng thử lại.";
}

export function useTrekkingRoutes() {
	const [items, setItems] = useState<CreatedTrekkingRoute[]>([]);
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilterState] = useState<RouteStatusFilter>("all");
	const [pagination, setPagination] = useState<TrekkingRoutesPagination>({
		page: 1,
		limit: ROUTES_PAGE_SIZE,
		total: 0,
		totalPages: 0,
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;

		setError("");
		setIsLoading(true);
		try {
			const response = await trekkingRoutesService.listMinePaginated(
				page,
				ROUTES_PAGE_SIZE,
				statusFilter
			);
			if (sequence !== requestSequence.current) return;
			if (response.pagination.totalPages > 0 && page > response.pagination.totalPages) {
				setPage(response.pagination.totalPages);
				return;
			}
			setItems(response.items);
			setPagination(response.pagination);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(listErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, [page, statusFilter]);

	const setStatusFilter = useCallback((status: RouteStatusFilter) => {
		setStatusFilterState(status);
		setPage(1);
	}, []);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return {
		items,
		pagination,
		statusFilter,
		isLoading,
		error,
		setPage,
		setStatusFilter,
		retry: load,
	};
}

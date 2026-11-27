import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { PaginatedTrips, SearchTripsQuery } from "../types";

export interface UseSearchTripsOptions {
	initialQuery?: SearchTripsQuery;
	autoFetch?: boolean;
}

export function useSearchTrips(options: UseSearchTripsOptions = {}) {
	const { initialQuery, autoFetch = true } = options;

	const [query, setQuery] = useState<SearchTripsQuery>(() => ({
		page: 1,
		limit: 12,
		...initialQuery,
	}));

	const [data, setData] = useState<PaginatedTrips | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(autoFetch);
	const [error, setError] = useState<string | null>(null);
	const [errorStatus, setErrorStatus] = useState<number | null>(null);

	const requestIdRef = useRef(0);
	const currentQueryRef = useRef(query);
	currentQueryRef.current = query;

	const executeSearch = useCallback(async (searchParams: SearchTripsQuery) => {
		const requestId = ++requestIdRef.current;
		setIsLoading(true);
		setError(null);
		setErrorStatus(null);

		try {
			const result = await tripsService.search(searchParams);
			if (requestId === requestIdRef.current) {
				setData(result);
			}
		} catch (err) {
			if (requestId === requestIdRef.current) {
				if (err instanceof HttpError) {
					setErrorStatus(err.status);
					if (err.status === 401) {
						setError("Vui lòng đăng nhập để xem danh sách chuyến đi.");
					} else if (err.status === 403) {
						setError("Bạn không có quyền xem danh sách chuyến đi.");
					} else if (err.status === 422) {
						setError("Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại ngày hoặc mức giá.");
					} else {
						setError("Không thể tải danh sách chuyến đi. Vui lòng thử lại.");
					}
				} else {
					setError("Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền.");
				}
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		if (autoFetch) {
			void executeSearch(query);
		}
	}, [query, autoFetch, executeSearch]);

	const updateFilters = useCallback((newFilters: Partial<SearchTripsQuery>) => {
		setQuery((prev) => {
			const next = { ...prev, ...newFilters };
			// Reset page to 1 when non-pagination filters change
			if (newFilters.page === undefined) {
				next.page = 1;
			}
			return next;
		});
	}, []);

	const setPage = useCallback((page: number) => {
		setQuery((prev) => ({ ...prev, page }));
	}, []);

	const retry = useCallback(() => {
		return executeSearch(currentQueryRef.current);
	}, [executeSearch]);

	const resetFilters = useCallback(() => {
		setQuery({
			page: 1,
			limit: 12,
		});
	}, []);

	return {
		query,
		data,
		items: data?.items ?? [],
		pagination: data?.pagination ?? null,
		isLoading,
		error,
		errorStatus,
		updateFilters,
		setPage,
		retry,
		resetFilters,
	};
}

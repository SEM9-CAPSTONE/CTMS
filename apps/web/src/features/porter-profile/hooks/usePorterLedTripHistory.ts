import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { porterProfileService } from "../services/porter-profile.service";
import type { PorterLedTripHistoryItem } from "../types";

const PAGE_SIZE = 5;

function historyErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
		if (error.status === 403) return "Bạn không có quyền xem lịch sử chuyến đi này.";
	}
	return "Không thể tải lịch sử chuyến đi đã dẫn. Vui lòng thử lại.";
}

export function usePorterLedTripHistory() {
	const [page, setPage] = useState(1);
	const [items, setItems] = useState<PorterLedTripHistoryItem[]>([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: PAGE_SIZE,
		total: 0,
		totalPages: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const result = await porterProfileService.getLedTripHistory(page, PAGE_SIZE);
			if (sequence !== requestSequence.current) return;
			setItems(result.items);
			setPagination(result.pagination);
		} catch (error: unknown) {
			if (sequence === requestSequence.current) {
				setErrorMessage(historyErrorMessage(error));
			}
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, [page]);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return {
		items,
		pagination,
		isLoading,
		errorMessage,
		page,
		setPage,
		reload: load,
	};
}

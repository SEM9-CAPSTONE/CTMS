import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { packingListService } from "../services/packing-list.service";
import type { PackingListResponse } from "../types";

function packingListErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem packing list của booking này.";
		if (error.status === 404) return "Không tìm thấy booking này.";
		if (error.status === 409)
			return "Không thể tạo packing list vì thông tin chuyến đi không còn khả dụng.";
	}
	return "Không thể tải packing list. Vui lòng thử lại.";
}

export function usePackingList(bookingId: string | undefined, refreshKey: number | string = 0) {
	const [packingList, setPackingList] = useState<PackingListResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		if (!bookingId) return;
		const sequence = ++requestSequence.current;

		setError("");
		setIsLoading(true);
		try {
			const fetched = await packingListService.getPackingList(bookingId);
			if (sequence === requestSequence.current) setPackingList(fetched);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(packingListErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, [bookingId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey deliberately re-triggers the same load
	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load, refreshKey]);

	return { packingList, isLoading, error, retry: load };
}

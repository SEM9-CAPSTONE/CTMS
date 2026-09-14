import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreatedTrekkingRoute } from "../types";

function listErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem tuyến đường.";
	}
	return "Không thể tải danh sách tuyến đường. Vui lòng thử lại.";
}

export function useTrekkingRoutes() {
	const [items, setItems] = useState<CreatedTrekkingRoute[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;

		setError("");
		setIsLoading(true);
		try {
			const routes = await trekkingRoutesService.listMine();
			if (sequence === requestSequence.current) setItems(routes);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(listErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return { items, isLoading, error, retry: load };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { RouteCheckpoint } from "../types";

function listError(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem checkpoint của tuyến này.";
		if (error.status === 404) return "Không tìm thấy tuyến trekking đã chọn.";
	}
	return "Không thể tải danh sách checkpoint. Vui lòng thử lại.";
}

export function useRouteCheckpoints(routeId?: string) {
	const [items, setItems] = useState<RouteCheckpoint[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const sequence = useRef(0);

	const load = useCallback(async () => {
		const current = ++sequence.current;
		if (!routeId) {
			setItems([]);
			setError("");
			setIsLoading(false);
			return;
		}
		setItems([]);
		setError("");
		setIsLoading(true);
		try {
			const checkpoints = await trekkingRoutesService.listCheckpoints(routeId);
			if (current === sequence.current) setItems(checkpoints);
		} catch (requestError) {
			if (current === sequence.current) setError(listError(requestError));
		} finally {
			if (current === sequence.current) setIsLoading(false);
		}
	}, [routeId]);

	useEffect(() => {
		void load();
		return () => {
			sequence.current += 1;
		};
	}, [load]);

	return { items, isLoading, error, reload: load };
}

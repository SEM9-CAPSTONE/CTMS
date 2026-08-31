import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { WeatherSnapshot } from "../types";

function latestWeatherErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem thời tiết của tuyến đường này.";
		if (error.status === 404) return "Không tìm thấy tuyến đường đã chọn.";
	}
	return "Không thể tải dữ liệu thời tiết. Vui lòng thử lại.";
}

/**
 * CTMS-25-T02. Mirrors useTrekkingRoutes' own auto-load-on-id-change +
 * request-sequence guard exactly -- `snapshot === null` after a successful,
 * non-loading load means "no weather has ever been fetched for this route
 * yet" (a real, distinct state from "still loading" or "errored"), not an
 * error.
 */
export function useRouteWeather(routeId?: string) {
	const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;
		if (!routeId) {
			setSnapshot(null);
			setError("");
			setIsLoading(false);
			return;
		}

		setError("");
		setIsLoading(true);
		try {
			const result = await trekkingRoutesService.getLatestWeather(routeId);
			if (sequence === requestSequence.current) setSnapshot(result);
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(latestWeatherErrorMessage(requestError));
		} finally {
			if (sequence === requestSequence.current) setIsLoading(false);
		}
	}, [routeId]);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	return { snapshot, isLoading, error, reload: load, setSnapshot };
}

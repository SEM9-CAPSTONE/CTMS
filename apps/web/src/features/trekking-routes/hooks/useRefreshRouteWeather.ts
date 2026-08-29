import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { WeatherSnapshot } from "../types";

export interface RefreshWeatherError {
	status?: number;
	message: string;
}

/**
 * CTMS-25-T02. Mirrors useRouteStatusAction's own error-mapping/in-flight
 * guard shape, plus the 2 outcomes specific to this action: 409 (route not
 * active -- BR-243, the backend guarantees zero side effect for this case)
 * and 503 (the provider failed after retries; the backend still recorded a
 * FAILED snapshot server-side per BR-229, this message says so rather than
 * implying nothing happened at all).
 */
export function mapRefreshWeatherError(error: unknown): RefreshWeatherError {
	if (!(error instanceof HttpError)) {
		return { message: "Không thể làm mới dữ liệu thời tiết. Vui lòng thử lại." };
	}
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền làm mới thời tiết cho tuyến đường này.",
		404: "Không tìm thấy tuyến đường.",
		409: "Chỉ có thể làm mới thời tiết khi tuyến đường đang ở trạng thái Hoạt động.",
		503: "Không thể kết nối dịch vụ thời tiết sau nhiều lần thử. Lần thử thất bại đã được ghi nhận.",
	};
	return {
		status: error.status,
		message: messages[error.status] ?? "Không thể làm mới dữ liệu thời tiết. Vui lòng thử lại.",
	};
}

export function useRefreshRouteWeather() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<RefreshWeatherError | null>(null);
	const inFlight = useRef(false);

	const refresh = useCallback(async (routeId: string): Promise<WeatherSnapshot | null> => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			return await trekkingRoutesService.refreshWeather(routeId);
		} catch (requestError) {
			setError(mapRefreshWeatherError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const resetError = useCallback(() => setError(null), []);
	return { isSubmitting, error, refresh, resetError };
}

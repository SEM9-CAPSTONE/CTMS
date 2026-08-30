import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { WeatherRiskAssessment } from "../types";

export interface WeatherRiskScoreError {
	status?: number;
	message: string;
}

export function mapWeatherRiskError(
	error: unknown,
	fallbackMessage: string
): WeatherRiskScoreError {
	if (!(error instanceof HttpError)) {
		return { message: fallbackMessage };
	}
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền đánh giá rủi ro thời tiết cho tuyến đường này.",
		404: "Không tìm thấy tuyến đường.",
		409: "Không thể đánh giá rủi ro: Đảm bảo tuyến đường đang ở trạng thái Hoạt động và đã được tải dữ liệu thời tiết thành công.",
	};
	return {
		status: error.status,
		message: messages[error.status] ?? fallbackMessage,
	};
}

export function useWeatherRiskScore(routeId?: string) {
	const [assessment, setAssessment] = useState<WeatherRiskAssessment | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [isCalculating, setIsCalculating] = useState(false);
	const [calculateError, setCalculateError] = useState<WeatherRiskScoreError | null>(null);

	const requestSequence = useRef(0);
	const inFlightCalculate = useRef(false);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;
		if (!routeId) {
			setAssessment(null);
			setError("");
			setIsLoading(false);
			return;
		}

		setError("");
		setIsLoading(true);
		try {
			const result = await trekkingRoutesService.getLatestWeatherRisk(routeId);
			if (sequence === requestSequence.current) {
				setAssessment(result);
			}
		} catch (requestError) {
			if (sequence === requestSequence.current) {
				setError(
					mapWeatherRiskError(
						requestError,
						"Không thể tải đánh giá rủi ro thời tiết. Vui lòng thử lại."
					).message
				);
			}
		} finally {
			if (sequence === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, [routeId]);

	const calculate = useCallback(async (): Promise<WeatherRiskAssessment | null> => {
		if (!routeId || inFlightCalculate.current) return null;

		inFlightCalculate.current = true;
		setIsCalculating(true);
		setCalculateError(null);

		try {
			const result = await trekkingRoutesService.calculateWeatherRisk(routeId);
			setAssessment(result);
			return result;
		} catch (requestError) {
			setCalculateError(
				mapWeatherRiskError(requestError, "Không thể tính điểm rủi ro thời tiết. Vui lòng thử lại.")
			);
			return null;
		} finally {
			inFlightCalculate.current = false;
			setIsCalculating(false);
		}
	}, [routeId]);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	const resetCalculateError = useCallback(() => setCalculateError(null), []);

	return {
		assessment,
		isLoading,
		error,
		calculate,
		isCalculating,
		calculateError,
		resetCalculateError,
		reload: load,
		setAssessment,
	};
}

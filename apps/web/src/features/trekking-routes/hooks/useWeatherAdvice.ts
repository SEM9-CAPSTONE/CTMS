import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { WeatherAdvice } from "../types";

export interface WeatherAdviceError {
	status?: number;
	message: string;
}

export function mapWeatherAdviceError(error: unknown, fallbackMessage: string): WeatherAdviceError {
	if (!(error instanceof HttpError)) {
		return { message: fallbackMessage };
	}
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền tạo lời khuyên thời tiết cho tuyến đường này.",
		404: "Không tìm thấy tuyến đường.",
		409: "Không thể tạo lời khuyên: Đảm bảo tuyến đường đang ở trạng thái Hoạt động và đã có đánh giá rủi ro thời tiết.",
		503: "Dịch vụ tư vấn thời tiết tạm thời không khả dụng. Vui lòng thử lại sau.",
	};
	return {
		status: error.status,
		message: messages[error.status] ?? fallbackMessage,
	};
}

export function useWeatherAdvice(routeId?: string) {
	const [advice, setAdvice] = useState<WeatherAdvice | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generateError, setGenerateError] = useState<WeatherAdviceError | null>(null);

	const requestSequence = useRef(0);
	const inFlightGenerate = useRef(false);

	const load = useCallback(async () => {
		const sequence = ++requestSequence.current;
		if (!routeId) {
			setAdvice(null);
			setError("");
			setIsLoading(false);
			return;
		}

		setError("");
		setIsLoading(true);
		try {
			const result = await trekkingRoutesService.getLatestWeatherAdvice(routeId);
			if (sequence === requestSequence.current) {
				setAdvice(result);
			}
		} catch (requestError) {
			if (sequence === requestSequence.current) {
				setError(
					mapWeatherAdviceError(
						requestError,
						"Không thể tải lời khuyên thời tiết. Vui lòng thử lại."
					).message
				);
			}
		} finally {
			if (sequence === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, [routeId]);

	const generate = useCallback(async (): Promise<WeatherAdvice | null> => {
		if (!routeId || inFlightGenerate.current) return null;

		inFlightGenerate.current = true;
		setIsGenerating(true);
		setGenerateError(null);

		try {
			const result = await trekkingRoutesService.generateWeatherAdvice(routeId);
			setAdvice(result);
			return result;
		} catch (requestError) {
			setGenerateError(
				mapWeatherAdviceError(requestError, "Không thể tạo lời khuyên thời tiết. Vui lòng thử lại.")
			);
			return null;
		} finally {
			inFlightGenerate.current = false;
			setIsGenerating(false);
		}
	}, [routeId]);

	useEffect(() => {
		void load();
		return () => {
			requestSequence.current += 1;
		};
	}, [load]);

	const resetGenerateError = useCallback(() => setGenerateError(null), []);

	return {
		advice,
		isLoading,
		error,
		generate,
		isGenerating,
		generateError,
		resetGenerateError,
		reload: load,
		setAdvice,
	};
}

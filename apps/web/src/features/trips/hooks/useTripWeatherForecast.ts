import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { TripWeatherForecast } from "../types";

export type TripWeatherForecastMode = "auto" | "submitted";

function forecastErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không thể dự báo thời tiết. Vui lòng thử lại.";
	const messages: Record<number, string> = {
		403: "Bạn không có quyền xem dự báo thời tiết của chuyến đi này.",
		404: "Không tìm thấy chuyến đi.",
		409: "Không thể dự báo cho chuyến đi ở trạng thái hiện tại hoặc chuyến đi đã kết thúc.",
		422: "Chuyến đi cần có tuyến và thời gian khởi hành, kết thúc để dự báo.",
		503: "Dịch vụ thời tiết tạm thời không khả dụng. Bạn vẫn có thể gửi duyệt.",
	};
	return messages[error.status] ?? "Không thể dự báo thời tiết. Vui lòng thử lại.";
}

function adviceErrorMessage(error: unknown): string {
	return error instanceof HttpError && error.status === 503
		? "Dịch vụ tư vấn AI tạm thời không khả dụng."
		: "Không tạo được lời khuyên.";
}

/**
 * Weather over a Trip's own schedule. `auto` forecasts on mount and whenever the
 * schedule changes (Host step 2); `submitted` shows the forecast attached at
 * submission (Admin review). Advice is generated afterwards without blocking.
 */
export function useTripWeatherForecast(
	tripId: string,
	mode: TripWeatherForecastMode,
	scheduleKey = ""
) {
	const [forecast, setForecast] = useState<TripWeatherForecast | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isAdviceLoading, setIsAdviceLoading] = useState(false);
	const [adviceError, setAdviceError] = useState<string | null>(null);
	const sequence = useRef(0);

	const generateAdvice = useCallback(
		async (current: TripWeatherForecast, requestId: number) => {
			if (current.status !== "available" || current.advice) return;
			setIsAdviceLoading(true);
			setAdviceError(null);
			try {
				const withAdvice = await tripsService.generateWeatherAdvice(tripId);
				if (requestId === sequence.current) setForecast(withAdvice);
			} catch (adviceFailure) {
				if (requestId === sequence.current) setAdviceError(adviceErrorMessage(adviceFailure));
			} finally {
				if (requestId === sequence.current) setIsAdviceLoading(false);
			}
		},
		[tripId]
	);

	const run = useCallback(async () => {
		const requestId = ++sequence.current;
		setIsLoading(true);
		setError(null);
		setAdviceError(null);
		try {
			const result =
				mode === "auto"
					? await tripsService.forecastWeather(tripId)
					: await tripsService.getSubmittedWeatherForecast(tripId);
			if (requestId !== sequence.current) return;
			setForecast(result);
			setIsLoading(false);
			if (result && mode === "auto") void generateAdvice(result, requestId);
		} catch (failure) {
			if (requestId !== sequence.current) return;
			setForecast(null);
			setError(forecastErrorMessage(failure));
			setIsLoading(false);
		}
	}, [generateAdvice, mode, tripId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scheduleKey re-runs the forecast when the Trip dates change
	useEffect(() => {
		void run();
	}, [run, scheduleKey]);

	return { forecast, isLoading, error, isAdviceLoading, adviceError, refresh: run };
}

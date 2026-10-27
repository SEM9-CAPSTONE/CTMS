import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CreateTripWaypointInput, SubmitTripInput, Trip } from "../types";

export interface ConfigureTripWaypointsError {
	status?: number;
	message: string;
	canRetry: boolean;
	fieldErrors: Record<string, string>;
}

interface BackendFieldError {
	field?: unknown;
	errors?: unknown;
}

function extractFieldErrors(errorData: unknown): Record<string, string> {
	if (typeof errorData !== "object" || errorData === null || !("message" in errorData)) return {};
	const message = (errorData as { message?: unknown }).message;
	if (!Array.isArray(message)) return {};
	return message.reduce<Record<string, string>>((accumulator, item) => {
		if (typeof item !== "object" || item === null) return accumulator;
		const issue = item as BackendFieldError;
		if (typeof issue.field !== "string" || !Array.isArray(issue.errors)) return accumulator;
		const firstError = issue.errors.find((value): value is string => typeof value === "string");
		if (firstError) accumulator[issue.field] = firstError;
		return accumulator;
	}, {});
}

function backendMessage(error: HttpError): string | null {
	if (
		typeof error.errorData !== "object" ||
		error.errorData === null ||
		!("message" in error.errorData)
	) {
		return null;
	}
	const message = (error.errorData as { message?: unknown }).message;
	if (typeof message === "string") return message;
	if (!Array.isArray(message)) return null;
	const values = message.flatMap((item) => {
		if (typeof item === "string") return [item];
		if (typeof item !== "object" || item === null) return [];
		const issue = item as BackendFieldError;
		const field = typeof issue.field === "string" ? issue.field : "payload";
		return Array.isArray(issue.errors)
			? issue.errors
					.filter((value): value is string => typeof value === "string")
					.map((value) => `${field}: ${value}`)
			: [];
	});
	return values.length ? values.join(". ") : null;
}

export function mapConfigureTripWaypointsError(error: unknown): ConfigureTripWaypointsError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể cấu hình điểm dừng. Vui lòng kiểm tra kết nối và thử lại.",
			canRetry: true,
			fieldErrors: {},
		};
	}

	const detail = backendMessage(error);
	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền cấu hình điểm dừng cho chuyến đi này.",
		404: "Không tìm thấy trip cần cấu hình.",
		409: "Chuyến đi không còn ở trạng thái cho phép cấu hình điểm dừng.",
		422: "Danh sách điểm dừng chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
	};

	const fieldErrors = extractFieldErrors(error.errorData);
	const weatherMessage = fieldErrors.weatherForecast
		? "Dự báo thời tiết không còn khớp lịch trình chuyến đi. Hệ thống đang dự báo lại, vui lòng gửi duyệt lại sau khi có kết quả."
		: fieldErrors.acknowledgeWeatherRisk
			? "Dự báo thời tiết đang ở mức Nguy hiểm. Hãy xác nhận đã biết rủi ro trước khi gửi duyệt."
			: null;

	return {
		status: error.status,
		message:
			weatherMessage ||
			detail ||
			byStatus[error.status] ||
			"Không thể cấu hình điểm dừng. Vui lòng thử lại.",
		canRetry: error.status === 409 || error.status >= 500,
		fieldErrors,
	};
}

/**
 * Persists a draft Trip's waypoints one at a time (create, update, delete) and submits the stored
 * waypoints for approval. Every call returns the Trip as saved in the database.
 */
export function useConfigureTripWaypoints(tripId: string) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<ConfigureTripWaypointsError | null>(null);
	const [configuredTrip, setConfiguredTrip] = useState<Trip | null>(null);
	const inFlight = useRef(false);
	const lastAction = useRef<(() => Promise<Trip>) | null>(null);

	const execute = useCallback(async (action: () => Promise<Trip>) => {
		if (inFlight.current) return null;
		lastAction.current = action;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			const updated = await action();
			setConfiguredTrip(updated);
			return updated;
		} catch (requestError) {
			setError(mapConfigureTripWaypointsError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const saveWaypoint = useCallback(
		(waypointId: string | null, input: CreateTripWaypointInput) =>
			execute(() =>
				waypointId
					? tripsService.updateWaypoint(tripId, waypointId, input)
					: tripsService.createWaypoint(tripId, input)
			),
		[execute, tripId]
	);

	const deleteWaypoint = useCallback(
		(waypointId: string) => execute(() => tripsService.deleteWaypoint(tripId, waypointId)),
		[execute, tripId]
	);

	const refresh = useCallback(
		() =>
			execute(async () => {
				const latest = await tripsService.getById(tripId);
				if (!latest.routeId) throw new Error("Trip route is unavailable");
				return { ...latest, routeId: latest.routeId };
			}),
		[execute, tripId]
	);

	const submit = useCallback(
		(input: SubmitTripInput = {}) => execute(() => tripsService.submitForApproval(tripId, input)),
		[execute, tripId]
	);

	const retry = useCallback(
		() => (lastAction.current ? execute(lastAction.current) : Promise.resolve(null)),
		[execute]
	);

	const reset = useCallback(() => {
		setConfiguredTrip(null);
		setError(null);
		lastAction.current = null;
	}, []);

	return {
		isSubmitting,
		error,
		configuredTrip,
		saveWaypoint,
		deleteWaypoint,
		submit,
		refresh,
		retry,
		reset,
	};
}

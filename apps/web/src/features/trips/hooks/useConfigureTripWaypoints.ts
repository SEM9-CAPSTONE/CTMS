import { useCallback, useRef, useState } from "react";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { ConfigureTripWaypointsInput, Trip } from "../types";

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
			message: "Không thể cấu hình waypoint. Vui lòng kiểm tra kết nối và thử lại.",
			canRetry: true,
			fieldErrors: {},
		};
	}

	const detail = backendMessage(error);
	const byStatus: Record<number, string> = {
		401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
		403: "Bạn không có quyền cấu hình waypoint cho trip này.",
		404: "Không tìm thấy trip cần cấu hình.",
		409: "Trip không còn ở trạng thái cho phép cấu hình waypoint.",
		422: "Danh sách waypoint chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
	};

	return {
		status: error.status,
		message: detail || byStatus[error.status] || "Không thể cấu hình waypoint. Vui lòng thử lại.",
		canRetry: error.status === 409 || error.status >= 500,
		fieldErrors: extractFieldErrors(error.errorData),
	};
}

export function useConfigureTripWaypoints(tripId: string) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<ConfigureTripWaypointsError | null>(null);
	const [configuredTrip, setConfiguredTrip] = useState<Trip | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<ConfigureTripWaypointsInput | null>(null);

	const execute = useCallback(
		async (payload: ConfigureTripWaypointsInput) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				const updated = await tripsService.configureWaypoints(tripId, payload);
				setConfiguredTrip(updated);
				return updated;
			} catch (requestError) {
				setError(mapConfigureTripWaypointsError(requestError));
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[tripId]
	);

	const submit = useCallback(
		(payload: ConfigureTripWaypointsInput) => {
			lastPayload.current = payload;
			return execute(payload);
		},
		[execute]
	);

	const retry = useCallback(
		() => (lastPayload.current ? execute(lastPayload.current) : Promise.resolve(null)),
		[execute]
	);

	const reset = useCallback(() => {
		setConfiguredTrip(null);
		setError(null);
		lastPayload.current = null;
	}, []);

	return { isSubmitting, error, configuredTrip, submit, retry, reset };
}
